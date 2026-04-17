#!/usr/bin/env bash
#
# Aplica as Branch Protection Rules da branch `master` via GitHub REST API.
#
# Pré-requisitos:
#   - `gh` CLI autenticado (`gh auth status`) com escopo `repo` e permissão
#     de admin no repositório.
#   - Executor deve rodar a partir de um clone do repositório (o owner/repo
#     é derivado de `gh repo view`).
#
# A configuração vive inline (heredoc) para ser revisada em diff. Editar
# apenas as regras versionadas aqui e rodar o script novamente — a chamada
# é idempotente (`PUT` substitui o estado existente).
#
# Uso:
#   ./scripts/branch-protection.sh
#
set -euo pipefail

BRANCH="master"
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

if [[ -z "${REPO}" ]]; then
  echo "ERRO: não consegui detectar owner/repo via \`gh repo view\`. Rode dentro do clone do repositório." >&2
  exit 1
fi

echo "Aplicando Branch Protection em ${REPO}@${BRANCH}..."

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "/repos/${REPO}/branches/${BRANCH}/protection" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "ci / lint",
      "ci / typecheck",
      "ci / test",
      "ci / coverage-sonar",
      "ci / build"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo "Branch Protection aplicada com sucesso em ${REPO}@${BRANCH}."
