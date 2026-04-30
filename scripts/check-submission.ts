import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const errors: string[] = [];

function assertFile(path: string, label: string) {
  if (!existsSync(path)) errors.push(`Missing ${label}: ${path}`);
}

function assertContains(path: string, label: string, substring: string) {
  if (!existsSync(path)) {
    errors.push(`Missing ${label}: ${path}`);
    return;
  }
  const content = readFileSync(path, "utf-8");
  if (!content.includes(substring)) {
    errors.push(`${label} does not contain '${substring}': ${path}`);
  }
}

function main() {
  assertFile(resolve("docs/privacy.md"), "privacy policy markdown");
  assertFile(resolve("docs/mcp.md"), "public documentation");
  assertFile(resolve("docs/mcp-submission-package.md"), "submission package");

  assertFile(resolve("docs/branding/logo.svg"), "logo light");
  assertFile(resolve("docs/branding/logo-dark.svg"), "logo dark");
  assertFile(resolve("docs/branding/favicon.ico"), "favicon ICO");
  assertFile(resolve("docs/branding/favicon-32.png"), "favicon PNG");

  const taglinePath = resolve("docs/branding/tagline.txt");
  const shortDescPath = resolve("docs/branding/desc-short.txt");
  const longDescPath = resolve("docs/branding/desc-long.md");
  assertFile(taglinePath, "tagline");
  assertFile(shortDescPath, "short description");
  assertFile(longDescPath, "long description");

  if (existsSync(taglinePath)) {
    const tagline = readFileSync(taglinePath, "utf-8").trim();
    if (tagline.length > 80) errors.push(`Tagline exceeds 80 chars (${tagline.length})`);
  }

  if (existsSync(shortDescPath)) {
    const shortDesc = readFileSync(shortDescPath, "utf-8").trim();
    if (shortDesc.length > 140) errors.push(`Short description exceeds 140 chars (${shortDesc.length})`);
  }

  if (existsSync(longDescPath)) {
    const longDesc = readFileSync(longDescPath, "utf-8").trim();
    if (longDesc.length > 2000) errors.push(`Long description exceeds 2000 chars (${longDesc.length})`);
  }

  // Screenshots
  const screenshots = readdirSync(resolve("docs/branding/screenshots")).filter((f: string) =>
    f.endsWith(".png")
  );
  if (screenshots.length < 3) {
    errors.push(`Expected at least 3 screenshots, found ${screenshots.length}`);
  }

  // Scripts
  assertFile(resolve("scripts/seed-demo-account.ts"), "seed script");
  assertFile(resolve("scripts/reset-demo-account.ts"), "reset script");

  // Check privacy URL reference
  assertContains(resolve("README.md"), "README", "https://api.bfincont.com.br/privacy");
  assertContains(resolve("docs/mcp.md"), "mcp.md", "https://api.bfincont.com.br/privacy");

  // Check demo account guard exists
  const guardFile = resolve("src/services/account-member-service.ts");
  assertContains(guardFile, "demo guard", "demoAccountId");

  if (errors.length > 0) {
    console.error("Submission check failed:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log("Submission check OK.");
  console.log("");
  console.log("=== Anthropic MCP Directory Submission Package ===");
  console.log("Privacy URL:    https://api.bfincont.com.br/privacy");
  console.log("Docs URL:       https://github.com/IgorGuariroba/bfin/blob/master/docs/mcp.md");
  console.log("Demo email:     mcp-review@bfincont.com.br");
  console.log("Logo:           docs/branding/logo.svg");
  console.log("Screenshots:    docs/branding/screenshots/");
  console.log("Tagline:        docs/branding/tagline.txt");
  console.log("Descriptions:   docs/branding/desc-short.txt | desc-long.md");
  console.log("");
  console.log("Ready to submit.");
}

main();
