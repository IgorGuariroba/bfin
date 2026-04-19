import { db } from "../src/db/index.js";
import { usuarios } from "../src/db/schema.js";
import { eq } from "drizzle-orm";
import { mcpLogger } from "../src/mcp/logger.js";

interface Args {
  email: string;
}

function parseArgs(argv: string[]): Args {
  const emailFlag = argv.find((a) => a.startsWith("--email="));
  if (!emailFlag) {
    console.error("Usage: npx tsx scripts/delete-mcp-user.ts --email=<email>");
    process.exit(1);
  }
  return { email: emailFlag.slice("--email=".length).trim() };
}

async function getAuth0Token(): Promise<string | null> {
  const domain = process.env.AUTH0_DOMAIN || process.env.MCP_AUTH_SERVER_URL;
  const clientId = process.env.AUTH0_MGMT_CLIENT_ID;
  const clientSecret = process.env.AUTH0_MGMT_CLIENT_SECRET;

  if (!domain || !clientId || !clientSecret) {
    return null;
  }

  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const res = await fetch(`https://${cleanDomain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      audience: `https://${cleanDomain}/api/v2/`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Auth0 token request failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function deleteAuth0User(token: string, auth0Id: string): Promise<void> {
  const domain = process.env.AUTH0_DOMAIN || process.env.MCP_AUTH_SERVER_URL;
  if (!domain) return;
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const res = await fetch(`https://${cleanDomain}/api/v2/users/${encodeURIComponent(auth0Id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`Auth0 delete user failed: ${res.status} ${await res.text()}`);
  }
}

async function main(): Promise<void> {
  const { email } = parseArgs(process.argv);

  const user = await db.query.usuarios.findFirst({
    where: eq(usuarios.email, email),
  });

  if (!user) {
    console.error(`User with email "${email}" not found in database.`);
    process.exit(1);
  }

  const auth0Id = user.idProvedor;

  // Attempt Auth0 deletion first
  let auth0Deleted = false;
  try {
    const token = await getAuth0Token();
    if (token) {
      await deleteAuth0User(token, auth0Id);
      auth0Deleted = true;
      console.log(`Auth0 user ${auth0Id} deleted.`);
    } else {
      console.warn("Auth0 Management API credentials not configured. Skipping Auth0 deletion.");
    }
  } catch (err) {
    console.error("Failed to delete Auth0 user:", err);
    process.exit(1);
  }

  // Delete from local database
  await db.delete(usuarios).where(eq(usuarios.id, user.id));

  mcpLogger.info(
    {
      user_id: user.id,
      email,
      auth0_id: auth0Id,
      auth0_deleted: auth0Deleted,
    },
    "mcp user deleted (LGPD/GDPR request)"
  );

  console.log(`Local user ${user.id} (${email}) deleted.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
