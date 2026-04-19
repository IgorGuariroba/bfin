## ADDED Requirements

### Requirement: Script versionado de Branch Protection
O repositório SHALL fornecer um script executável `scripts/branch-protection.sh` que aplica Branch Protection Rules na branch `master` usando a GitHub CLI (`gh api`), permitindo que a configuração seja revisada em PR e versionada no git.

#### Scenario: Script é versionado no repositório
- **WHEN** um contribuidor clona o repositório
- **THEN** existe `scripts/branch-protection.sh` com permissão de execução e um bloco JSON inline descrevendo a configuração completa de proteção

#### Scenario: Execução do script por admin
- **WHEN** um admin com token `gh` autenticado (escopo `repo`) executa `./scripts/branch-protection.sh`
- **THEN** o script envia uma requisição `PUT /repos/{owner}/{repo}/branches/master/protection` à API do GitHub e reporta sucesso ou o erro retornado

#### Scenario: Idempotência
- **WHEN** o script é executado múltiplas vezes em sequência sem alteração no JSON de configuração
- **THEN** a proteção resultante é a mesma após cada execução, sem efeitos colaterais cumulativos

### Requirement: Required status checks alinhados com CI
O script `branch-protection.sh` SHALL declarar como `required_status_checks.contexts` exatamente os jobs definidos no workflow `ci.yml`: `ci / lint`, `ci / typecheck`, `ci / test`, `ci / coverage-sonar`, `ci / build`.

#### Scenario: Merge bloqueado por gate vermelho
- **WHEN** um PR tem qualquer job de `ci.yml` com status não-sucesso
- **THEN** a UI do GitHub bloqueia o botão de merge com a mensagem "Required statuses must pass"

#### Scenario: Strict (branch atualizada)
- **WHEN** a configuração é aplicada
- **THEN** `required_status_checks.strict` é `true`, exigindo que a branch do PR esteja em dia com `master` antes do merge

### Requirement: Review obrigatório em PR
A configuração SHALL exigir pelo menos uma aprovação em cada Pull Request contra `master`, com dismissal de reviews antigas em novos commits.

#### Scenario: Merge sem review
- **WHEN** um PR tem todos os status checks verdes mas nenhuma aprovação
- **THEN** o GitHub bloqueia o merge exigindo review

#### Scenario: Dismissal de review antiga
- **WHEN** um PR é aprovado e em seguida recebe novos commits
- **THEN** as aprovações existentes são invalidadas automaticamente e uma nova review é necessária

### Requirement: Histórico linear
A configuração SHALL exigir histórico linear na branch `master` (`required_linear_history: true`), permitindo apenas merges do tipo squash ou rebase.

#### Scenario: Merge commit bloqueado
- **WHEN** um PR é mergeado com a estratégia "Create a merge commit"
- **THEN** o GitHub rejeita a operação exigindo squash ou rebase

### Requirement: Documentação do processo
O repositório SHALL incluir documentação em `docs/ci.md` explicando como rodar cada gate localmente, como executar `scripts/branch-protection.sh`, quais pré-requisitos de autenticação são necessários e como atualizar os required status checks quando um novo job é adicionado ao `ci.yml`.

#### Scenario: Onboarding de novo contribuidor
- **WHEN** um contribuidor precisa entender os gates de CI
- **THEN** o arquivo `docs/ci.md` lista cada job, o comando local equivalente e o procedimento para aplicar/alterar Branch Protection

#### Scenario: Adição de novo gate
- **WHEN** um dev adiciona um novo job ao `ci.yml`
- **THEN** `docs/ci.md` instrui a atualizar `scripts/branch-protection.sh` no mesmo PR para manter `required_status_checks.contexts` em sincronia
