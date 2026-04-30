import { FastifyInstance } from "fastify";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function mdToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;

  for (let line of lines) {
    line = line.trimEnd();
    if (line.startsWith("### ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith("- ")) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${escapeHtml(line.slice(2))}</li>`);
    } else if (line === "") {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("<br>");
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  if (inList) out.push("</ul>");

  return out.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function privacyRoutes(app: FastifyInstance): Promise<void> {
  app.get("/privacy/v1", async (_req, reply) => {
    return reply.redirect("/privacy");
  });

  app.get("/privacy", async (_req, reply) => {
    const path = resolve(process.cwd(), "docs/privacy.md");
    const md = readFileSync(path, "utf-8");
    const body = mdToHtml(md);
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Política de Privacidade — BFin</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:680px;margin:40px auto;padding:0 20px;line-height:1.6;color:#222}
h2{font-size:1.4rem;margin-top:2rem;border-bottom:1px solid #ddd;padding-bottom:.25rem}
h3{font-size:1.1rem;margin-top:1.5rem;color:#444}
ul{padding-left:1.5rem}
p{margin:.6rem 0}
table{border-collapse:collapse;width:100%;margin:1rem 0}
th,td{border:1px solid #ccc;padding:.4rem .6rem;text-align:left}
th{background:#f5f5f5}
</style>
</head>
<body>
${body}
</body>
</html>`;
    return reply.type("text/html").send(html);
  });
}
