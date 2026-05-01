import { FastifyInstance } from "fastify";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { z } from "zod";
import { ZodTypeProvider } from "fastify-type-provider-zod";

const marked = new Marked({ gfm: true, breaks: false, async: false });

const PRIVACY_MD_PATH = resolve(process.cwd(), "docs/privacy.md");

export async function privacyRoutes(app: FastifyInstance): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    "/privacy/v1",
    {
      schema: {
        description: "Redireciona para a versão atual da política de privacidade",
        response: {
          302: z.null(),
        },
      },
    },
    async (_req, reply) => {
      return reply.redirect("/privacy");
    }
  );

  typedApp.get(
    "/privacy",
    {
      schema: {
        description: "Serve a política de privacidade em formato HTML",
        response: {
          200: z.string().describe("HTML da política de privacidade"),
          500: z.string(),
        },
      },
    },
    async (_req, reply) => {
      try {
        const content = readFileSync(PRIVACY_MD_PATH, "utf-8");
        const body = DOMPurify.sanitize(marked.parse(content) as string);
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
      } catch (err) {
        app.log.error(err);
        return reply.status(500).send("Privacy policy temporarily unavailable.");
      }
    }
  );
}
