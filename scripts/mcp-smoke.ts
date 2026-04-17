/**
 * End-to-end smoke test for the MCP server.
 *
 * Runs a fake OIDC provider, signs a SA token, spawns `node dist/mcp/server.js`
 * as a child process, talks JSON-RPC via stdin/stdout, and asserts a few calls.
 *
 * Required env:
 *   DATABASE_URL         — DB the MCP will query
 *   SA_USER_ID           — UUID already present in usuarios (acts as SA acting user)
 *   CONTA_ID             — UUID of a conta where SA has owner role
 *   CATEGORIA_RECEITA_ID — UUID of a receita category
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { createInterface } from "node:readline";

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

function env(name: string): string {
  const v = process.env[name];
  if (!v) {
    process.stderr.write(`missing env ${name}\n`);
    process.exit(2);
  }
  return v;
}

async function main(): Promise<void> {
  const DATABASE_URL = env("DATABASE_URL");
  const SA_USER_ID = env("SA_USER_ID");
  const CONTA_ID = env("CONTA_ID");
  const CATEGORIA_RECEITA_ID = env("CATEGORIA_RECEITA_ID");

  const port = 4444;
  const issuerUrl = `http://127.0.0.1:${port}`;
  const audience = "bfin-mcp";
  const kid = "mcp-smoke";

  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    modulusLength: 2048,
    extractable: true,
  });
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = kid;
  publicJwk.use = "sig";
  publicJwk.alg = "RS256";

  const now = Math.floor(Date.now() / 1000);
  const scopes = [
    "accounts:read",
    "accounts:write",
    "transactions:read",
    "transactions:write",
    "categories:read",
  ];
  const saToken = await new SignJWT({ scope: scopes.join(" ") })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(issuerUrl)
    .setAudience(audience)
    .setSubject("bfin-mcp-smoke")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const oidcServer = createServer((req, res) => {
    if (req.url === "/.well-known/openid-configuration") {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          issuer: issuerUrl,
          jwks_uri: `${issuerUrl}/jwks`,
          authorization_endpoint: `${issuerUrl}/authorize`,
          token_endpoint: `${issuerUrl}/token`,
          response_types_supported: ["code"],
          id_token_signing_alg_values_supported: ["RS256"],
          subject_types_supported: ["public"],
        })
      );
      return;
    }
    if (req.url === "/jwks") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ keys: [publicJwk] }));
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((resolve, reject) => {
    oidcServer.once("error", reject);
    oidcServer.listen(port, "127.0.0.1", () => resolve());
  });
  log(`OIDC fake on ${issuerUrl}`);

  const child = spawn("node", ["dist/mcp/server.js"], {
    env: {
      ...process.env,
      DATABASE_URL,
      OIDC_ISSUER_URL: issuerUrl,
      MCP_OIDC_AUDIENCE: audience,
      MCP_SERVICE_ACCOUNT_TOKEN: saToken,
      MCP_SUBJECT_USER_ID: SA_USER_ID,
      LOG_LEVEL: "info",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const rl = createInterface({ input: child.stdout });
  const pending = new Map<number, (r: JsonRpcResponse) => void>();
  rl.on("line", (line) => {
    if (!line.trim()) return;
    try {
      const msg = JSON.parse(line) as JsonRpcResponse;
      if (typeof msg.id === "number" && pending.has(msg.id)) {
        pending.get(msg.id)!(msg);
        pending.delete(msg.id);
      }
    } catch (err) {
      log(`BAD JSON from stdout: ${line} (${String(err)})`);
    }
  });

  child.stderr.on("data", (buf: Buffer) => {
    process.stderr.write(`[mcp-stderr] ${buf.toString()}`);
  });

  let id = 0;
  function rpc(method: string, params?: unknown): Promise<JsonRpcResponse> {
    id += 1;
    const reqId = id;
    const payload = JSON.stringify({ jsonrpc: "2.0", id: reqId, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(reqId);
        reject(new Error(`timeout waiting for ${method}`));
      }, 15_000);
      pending.set(reqId, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      child.stdin.write(payload + "\n");
    });
  }

  function notify(method: string, params?: unknown): void {
    const payload = JSON.stringify({ jsonrpc: "2.0", method, params });
    child.stdin.write(payload + "\n");
  }

  await waitReady(child);

  const results: { step: string; ok: boolean; note?: string }[] = [];

  // 1. initialize
  const init = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "mcp-smoke", version: "0.0.0" },
  });
  const initOk = !!(init.result as { protocolVersion?: string } | undefined)?.protocolVersion;
  results.push({
    step: "initialize",
    ok: initOk,
    note: JSON.stringify(init.result ?? init.error),
  });
  notify("notifications/initialized");

  // 2. tools/list
  const list = await rpc("tools/list", {});
  const tools = (list.result as { tools: { name: string }[] }).tools;
  const names = tools.map((t) => t.name).sort();
  results.push({
    step: "tools/list",
    ok: names.includes("mcp.whoami") && names.includes("accounts.create"),
    note: `${tools.length} tools: ${names.slice(0, 8).join(",")}...`,
  });

  // 3. mcp.whoami
  const whoami = await rpc("tools/call", {
    name: "mcp.whoami",
    arguments: {},
  });
  const whoamiText = extractText(whoami);
  const whoamiParsed = whoamiText ? JSON.parse(whoamiText) : null;
  results.push({
    step: "tools/call mcp.whoami",
    ok:
      whoamiParsed?.serviceAccount === true &&
      whoamiParsed?.actingUserId === SA_USER_ID,
    note: whoamiText?.slice(0, 120),
  });

  // 4. accounts.list
  const accList = await rpc("tools/call", {
    name: "accounts.list",
    arguments: { limit: 5 },
  });
  const accListText = extractText(accList);
  const accListParsed = accListText ? JSON.parse(accListText) : null;
  results.push({
    step: "tools/call accounts.list",
    ok: Array.isArray(accListParsed?.data) && accListParsed.data.length >= 1,
    note: `${accListParsed?.data?.length ?? "?"} accounts`,
  });

  // 5. scope enforcement: try a tool we DO have scope for + write that needs owner
  const txnCreate = await rpc("tools/call", {
    name: "transactions.create",
    arguments: {
      contaId: CONTA_ID,
      tipo: "receita",
      categoriaId: CATEGORIA_RECEITA_ID,
      descricao: "Smoke MCP",
      valor: 123.45,
      data: new Date().toISOString(),
    },
  });
  const txnCreateText = extractText(txnCreate);
  const txnCreateParsed = txnCreateText ? safeJson(txnCreateText) : null;
  const txnCreateResult = txnCreate.result as { isError?: boolean } | undefined;
  results.push({
    step: "tools/call transactions.create",
    ok:
      txnCreateResult?.isError !== true &&
      txnCreateParsed?.id !== undefined,
    note: txnCreateText?.slice(0, 120),
  });

  // 6. denied scope: categories.create (no scope granted)
  const catCreate = await rpc("tools/call", {
    name: "categories.create",
    arguments: {
      contaId: CONTA_ID,
      nome: "Should Fail",
      tipo: "receita",
    },
  });
  const catCreateResult = catCreate.result as
    | { isError?: boolean; content?: { text?: string }[] }
    | undefined;
  const catErrText = catCreateResult?.content?.[0]?.text ?? "";
  results.push({
    step: "tools/call categories.create (scope denied)",
    ok:
      catCreateResult?.isError === true &&
      /Unauthorized|scope/i.test(catErrText),
    note: catErrText.slice(0, 120),
  });

  // shutdown
  child.stdin.end();
  await new Promise<void>((r) => child.on("exit", () => r()));
  oidcServer.close();

  // report
  const pass = results.every((r) => r.ok);
  process.stdout.write("\n================ MCP SMOKE RESULTS ================\n");
  for (const r of results) {
    process.stdout.write(
      `${r.ok ? "✓" : "✗"} ${r.step}${r.note ? ` — ${r.note}` : ""}\n`
    );
  }
  process.stdout.write("===================================================\n");
  process.stdout.write(pass ? "ALL GOOD ✓\n" : "FAILED ✗\n");
  process.exit(pass ? 0 : 1);
}

function log(msg: string): void {
  process.stderr.write(`[smoke] ${msg}\n`);
}

function waitReady(child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("MCP never became ready")), 15_000);
    child.stderr!.on("data", (buf: Buffer) => {
      if (buf.toString().includes("MCP server ready")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on("exit", (code) => reject(new Error(`MCP exited early: ${code}`)));
  });
}

function extractText(resp: JsonRpcResponse): string | null {
  const r = resp.result as
    | { content?: { type: string; text: string }[] }
    | undefined;
  const first = r?.content?.[0];
  return first?.text ?? null;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

main().catch((err) => {
  process.stderr.write(`smoke failed: ${String(err)}\n`);
  process.exit(1);
});
