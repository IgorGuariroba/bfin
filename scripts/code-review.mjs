#!/usr/bin/env node
import { execSync } from "node:child_process";

const {
  GEMINI_API_KEY,
  GH_TOKEN,
  REPO,
  PR_NUMBER,
  HEAD_SHA,
  GEMINI_MODEL = "gemini-3-pro-preview",
} = process.env;

if (!GEMINI_API_KEY || !GH_TOKEN || !REPO || !PR_NUMBER || !HEAD_SHA) {
  console.error("Missing required env: GEMINI_API_KEY, GH_TOKEN, REPO, PR_NUMBER, HEAD_SHA");
  process.exit(1);
}

const ghApi = (path, init = {}) =>
  fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${GH_TOKEN}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
      ...init.headers,
    },
  });

const diff = execSync(`gh pr diff ${PR_NUMBER} --repo ${REPO}`, {
  encoding: "utf8",
  maxBuffer: 16 * 1024 * 1024,
});

const prTitle = execSync(`gh pr view ${PR_NUMBER} --repo ${REPO} --json title --jq .title`, {
  encoding: "utf8",
}).trim();

const systemInstruction = `Você é um revisor de código sênior. Sempre responda em português do Brasil.

Revise o diff do PR abaixo. Foque em problemas reais e acionáveis: bugs, falhas de segurança, regressões, vazamento de recursos, race conditions, contratos quebrados, edge cases não cobertos. Ignore questões de estilo a menos que prejudiquem clareza.

Para cada achado relevante, produza um item com:
- path: caminho do arquivo (do diff)
- line: linha no arquivo modificado (lado RIGHT do diff)
- severity: LOW | MEDIUM | HIGH | CRITICAL
- body: descrição curta + sugestão de correção

Se não houver achados relevantes, retorne comments=[] e summary explicando que está tudo certo.

Limite a 10 comentários. Severidade só HIGH/CRITICAL pode falhar o check.`;

const schema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    comments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          line: { type: "integer" },
          severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
          body: { type: "string" },
        },
        required: ["path", "line", "severity", "body"],
      },
    },
  },
  required: ["summary", "comments"],
};

const userPrompt = `# PR: ${prTitle}\n\n\`\`\`diff\n${diff}\n\`\`\``;

console.log(`Calling ${GEMINI_MODEL} with diff (${diff.length} chars)...`);

const geminiRes = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.2,
      },
    }),
  },
);

if (!geminiRes.ok) {
  console.error(`Gemini API error ${geminiRes.status}: ${await geminiRes.text()}`);
  process.exit(1);
}

const geminiJson = await geminiRes.json();
const text = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
if (!text) {
  console.error("Empty Gemini response", JSON.stringify(geminiJson));
  process.exit(1);
}

const review = JSON.parse(text);
console.log(`Gemini returned ${review.comments.length} comments. Summary: ${review.summary}`);

const sevEmoji = { LOW: "ℹ️", MEDIUM: "⚠️", HIGH: "🔴", CRITICAL: "🚨" };

const inlineComments = review.comments
  .filter((c) => c.path && Number.isInteger(c.line))
  .map((c) => ({
    path: c.path,
    line: c.line,
    side: "RIGHT",
    body: `${sevEmoji[c.severity] ?? ""} **${c.severity}** — ${c.body}`,
  }));

const reviewBody = `## Code Review (${GEMINI_MODEL})\n\n${review.summary}`;

const reviewRes = await ghApi(`/repos/${REPO}/pulls/${PR_NUMBER}/reviews`, {
  method: "POST",
  body: JSON.stringify({
    commit_id: HEAD_SHA,
    body: reviewBody,
    event: "COMMENT",
    comments: inlineComments,
  }),
});

if (!reviewRes.ok) {
  const err = await reviewRes.text();
  console.error(`GitHub review POST failed ${reviewRes.status}: ${err}`);

  if (inlineComments.length > 0) {
    console.error("Falling back to summary-only review");
    const fallback = await ghApi(`/repos/${REPO}/pulls/${PR_NUMBER}/reviews`, {
      method: "POST",
      body: JSON.stringify({ commit_id: HEAD_SHA, body: reviewBody, event: "COMMENT" }),
    });
    if (!fallback.ok) {
      console.error(`Fallback also failed: ${await fallback.text()}`);
      process.exit(1);
    }
  } else {
    process.exit(1);
  }
}

const blocking = review.comments.filter((c) => c.severity === "CRITICAL");
if (blocking.length > 0) {
  console.error(`Found ${blocking.length} CRITICAL issue(s) — failing check.`);
  process.exit(1);
}

console.log("Review posted successfully.");
