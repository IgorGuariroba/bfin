#!/usr/bin/env node
import { execSync } from "node:child_process";

const {
  ZAI_API_KEY,
  GH_TOKEN,
  REPO,
  PR_NUMBER,
  HEAD_SHA,
  ZAI_MODEL = "glm-5.1",
  ZAI_BASE_URL = "https://api.z.ai/api/coding/paas/v4",
} = process.env;

if (!ZAI_API_KEY || !GH_TOKEN || !REPO || !PR_NUMBER || !HEAD_SHA) {
  console.error("Missing required env: ZAI_API_KEY, GH_TOKEN, REPO, PR_NUMBER, HEAD_SHA");
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

Reporte APENAS achados de severidade HIGH ou CRITICAL. Descarte LOW e MEDIUM — não inclua no array de comentários.

Retorne JSON estrito no formato:
{
  "summary": "string — resumo geral do PR e qualidade",
  "comments": [
    {
      "path": "string — caminho do arquivo conforme o diff",
      "line": int — número da linha no arquivo modificado (lado RIGHT do diff),
      "severity": "HIGH" | "CRITICAL",
      "body": "string — descrição curta + sugestão de correção"
    }
  ]
}

Se não houver achados HIGH/CRITICAL, retorne comments=[] e summary explicando que está tudo certo.

Limite a 10 comentários. Severidade só CRITICAL faz o check falhar.`;

const userPrompt = `# PR: ${prTitle}\n\n\`\`\`diff\n${diff}\n\`\`\``;

console.log(`Calling ${ZAI_MODEL} at ${ZAI_BASE_URL} with diff (${diff.length} chars)...`);

const llmRes = await fetch(`${ZAI_BASE_URL}/chat/completions`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${ZAI_API_KEY}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model: ZAI_MODEL,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  }),
});

if (!llmRes.ok) {
  console.error(`Z.AI API error ${llmRes.status}: ${await llmRes.text()}`);
  process.exit(1);
}

const llmJson = await llmRes.json();
const text = llmJson?.choices?.[0]?.message?.content;
if (!text) {
  console.error("Empty Z.AI response", JSON.stringify(llmJson));
  process.exit(1);
}

let review;
try {
  review = JSON.parse(text);
} catch (err) {
  console.error("Failed to parse JSON from model:", text);
  process.exit(1);
}

if (!Array.isArray(review.comments)) review.comments = [];
if (typeof review.summary !== "string") review.summary = "(sem resumo)";

console.log(`Model returned ${review.comments.length} comments. Summary: ${review.summary}`);

const sevEmoji = { LOW: "ℹ️", MEDIUM: "⚠️", HIGH: "🔴", CRITICAL: "🚨" };

const inlineComments = review.comments
  .filter(
    (c) =>
      c &&
      typeof c.path === "string" &&
      Number.isInteger(c.line) &&
      (c.severity === "HIGH" || c.severity === "CRITICAL"),
  )
  .map((c) => ({
    path: c.path,
    line: c.line,
    side: "RIGHT",
    body: `${sevEmoji[c.severity] ?? ""} **${c.severity ?? "INFO"}** — ${c.body ?? ""}`,
  }));

const reviewBody = `## Code Review (${ZAI_MODEL})\n\n${review.summary}`;

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

const blocking = review.comments.filter((c) => c?.severity === "CRITICAL");
if (blocking.length > 0) {
  console.error(`Found ${blocking.length} CRITICAL issue(s) — failing check.`);
  process.exit(1);
}

console.log("Review posted successfully.");
