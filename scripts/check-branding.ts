import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const BRANDING_DIR = resolve(process.cwd(), "docs/branding");

function checkFile(path: string, label: string, maxBytes?: number, maxChars?: number) {
  if (!existsSync(path)) {
    return [`Missing ${label}: ${path}`];
  }
  if (maxBytes) {
    const size = readFileSync(path).length;
    if (size > maxBytes) {
      return [`${label} exceeds ${maxBytes} bytes (${size}): ${path}`];
    }
  }
  if (maxChars) {
    const text = readFileSync(path, "utf-8").trim();
    if (text.length > maxChars) {
      return [`${label} exceeds ${maxChars} chars (${text.length}): ${path}`];
    }
  }
  return [];
}

function main() {
  const errors: string[] = [];

  errors.push(...checkFile(resolve(BRANDING_DIR, "logo.svg"), "logo.svg"));
  errors.push(...checkFile(resolve(BRANDING_DIR, "logo-dark.svg"), "logo-dark.svg"));
  errors.push(...checkFile(resolve(BRANDING_DIR, "favicon.ico"), "favicon.ico"));
  errors.push(...checkFile(resolve(BRANDING_DIR, "favicon-32.png"), "favicon-32.png"));

  // Screenshots
  const screenshotsDir = resolve(BRANDING_DIR, "screenshots");
  let screenshotsCount = 0;
  if (!existsSync(screenshotsDir)) {
    errors.push(`Missing screenshots directory: ${screenshotsDir}`);
  } else {
    const screenshots = readdirSync(screenshotsDir).filter((f) => f.endsWith(".png"));
    screenshotsCount = screenshots.length;
    if (screenshots.length < 3) {
      errors.push(`Expected at least 3 screenshots in docs/branding/screenshots, found ${screenshots.length}`);
    }
  }

  errors.push(...checkFile(resolve(BRANDING_DIR, "tagline.txt"), "tagline.txt", undefined, 80));
  errors.push(...checkFile(resolve(BRANDING_DIR, "desc-short.txt"), "desc-short.txt", undefined, 140));
  errors.push(...checkFile(resolve(BRANDING_DIR, "desc-long.md"), "desc-long.md", 2000));

  if (errors.length > 0) {
    console.error("Branding check failed:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(`Branding check OK (screenshots: ${screenshotsCount}).`);
}

main();
