/**
 * Local fake OIDC provider + test JWT issuer for MCP dev.
 *
 * Runs an HTTP server that serves:
 *   - /.well-known/openid-configuration  (issuer metadata)
 *   - /jwks                              (public JWKS)
 *
 * Also prints a ready-to-use signed JWT and the env vars to export
 * before running the MCP inspector.
 *
 * Usage:
 *   npx tsx scripts/mcp-dev-oidc.ts \
 *     --subject-user-id <uuid-of-usuarios.id> \
 *     [--port 4444] \
 *     [--audience bfin-mcp] \
 *     [--scope "accounts:read transactions:read transactions:write ..."]
 *
 * Then, in another terminal, export the printed env vars and run:
 *   npx @modelcontextprotocol/inspector node dist/mcp/server.js
 */
import { createServer } from "node:http";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

type Args = {
  port: number;
  audience: string;
  scope: string;
  subject: string;
  subjectUserId: string;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string, fallback?: string): string | undefined => {
    const idx = argv.indexOf(flag);
    if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
    return fallback;
  };
  const port = Number(get("--port", "4444"));
  const audience = get("--audience", "bfin-mcp")!;
  const scope =
    get(
      "--scope",
      [
        "accounts:read",
        "accounts:write",
        "account-members:read",
        "categories:read",
        "categories:write",
        "transactions:read",
        "transactions:write",
        "debts:read",
        "debts:write",
        "goals:read",
        "goals:write",
        "daily-limit:read",
        "daily-limit:write",
        "projections:read",
      ].join(" ")
    )!;
  const subject = get("--subject", "bfin-mcp-sa")!;
  const subjectUserId = get("--subject-user-id")!;
  if (!subjectUserId) {
    process.stderr.write(
      "ERROR: --subject-user-id <uuid> is required (must exist in usuarios.id)\n"
    );
    process.exit(1);
  }
  return { port, audience, scope, subject, subjectUserId };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const issuerUrl = `http://127.0.0.1:${args.port}`;
  const kid = "bfin-mcp-dev";

  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    modulusLength: 2048,
    extractable: true,
  });
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = kid;
  publicJwk.use = "sig";
  publicJwk.alg = "RS256";

  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    scope: args.scope,
  })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(issuerUrl)
    .setAudience(args.audience)
    .setSubject(args.subject)
    .setIssuedAt(now)
    .setExpirationTime(now + 8 * 60 * 60)
    .sign(privateKey);

  const server = createServer((req, res) => {
    if (!req.url) {
      res.statusCode = 404;
      res.end();
      return;
    }
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
    server.once("error", reject);
    server.listen(args.port, "127.0.0.1", () => resolve());
  });

  const envLines = [
    `OIDC_ISSUER_URL=${issuerUrl}`,
    `MCP_OIDC_AUDIENCE=${args.audience}`,
    `MCP_SUBJECT_USER_ID=${args.subjectUserId}`,
    `MCP_SERVICE_ACCOUNT_TOKEN=${token}`,
  ];

  process.stdout.write(
    [
      "",
      "============================================================",
      " Fake OIDC provider running for MCP dev",
      "============================================================",
      `  issuer:   ${issuerUrl}`,
      `  audience: ${args.audience}`,
      `  subject:  ${args.subject}`,
      `  scopes:   ${args.scope}`,
      `  token exp: ${new Date((now + 8 * 60 * 60) * 1000).toISOString()}`,
      "",
      " Export these env vars in another terminal:",
      "",
      ...envLines.map((l) => `  export ${l}`),
      "",
      " Then run the MCP Inspector against the built server:",
      "",
      "  npm run build",
      "  npx @modelcontextprotocol/inspector node dist/mcp/server.js",
      "",
      " Tip: call mcp.whoami first — it needs no scopes and confirms bootstrap.",
      "",
      " Ctrl+C to stop this fake OIDC provider.",
      "============================================================",
      "",
    ].join("\n")
  );

  const shutdown = (): void => {
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  process.stderr.write(`mcp-dev-oidc failed: ${String(err)}\n`);
  process.exit(1);
});
