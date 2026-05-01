## ADDED Requirements

### Requirement: Repositório separado bfin-web
O sistema SHALL ter o frontend web em repositório dedicado `bfin-web` (Next.js 15 App Router, TypeScript strict). O repo `bfin` (API) NÃO contém código frontend.

#### Scenario: Estrutura inicial
- **WHEN** o repo `bfin-web` é clonado
- **THEN** contém estrutura `app/`, `lib/`, `components/`, `features/`, `middleware.ts`, com TypeScript strict habilitado em `tsconfig.json`

### Requirement: Autenticação via Auth0
O frontend SHALL autenticar usuários usando `@auth0/nextjs-auth0` v4. A sessão SHALL ser armazenada em cookie HTTP-only `appSession`. O bearer token NUNCA SHALL ser exposto ao código JavaScript do browser.

#### Scenario: Login fluxo
- **WHEN** usuário não autenticado acessa rota em `(app)/*`
- **THEN** middleware redireciona para `/api/auth/login`, que inicia fluxo OAuth Auth0; após callback usuário retorna autenticado

#### Scenario: Logout
- **WHEN** usuário aciona logout
- **THEN** sistema limpa cookie `appSession` e redireciona para Auth0 logout endpoint

#### Scenario: Proteção de rotas
- **WHEN** request chega em `(app)/*` sem cookie de sessão válido
- **THEN** middleware redireciona para login antes de renderizar a página

### Requirement: Proxy server-side para API
O frontend SHALL expor route handler `/api/bfin/[...path]` que recebe requests do browser, recupera `accessToken` via `getAccessToken()` do Auth0 SDK e encaminha à API Fastify com header `Authorization: Bearer <token>`.

#### Scenario: Request autenticado via proxy
- **WHEN** componente cliente faz `fetch('/api/bfin/contas/<id>/transacoes')`
- **THEN** o route handler injeta bearer Auth0, encaminha para `${BFIN_API_URL}/contas/<id>/transacoes` e devolve a resposta ao browser sem expor o token

#### Scenario: Token expirado durante refresh
- **WHEN** o `accessToken` expirou no momento da chamada
- **THEN** o SDK Auth0 faz refresh transparente e a request prossegue com novo token

#### Scenario: Sessão inválida
- **WHEN** o proxy não consegue obter `accessToken` (sessão revogada/expirada sem refresh)
- **THEN** retorna `401 Unauthorized` ao browser, que dispara redirect ao login

### Requirement: Account scoping no cliente
O frontend SHALL manter conta ativa em store Zustand persistido (cookie ou localStorage). Hooks de API SHALL injetar `contaId` automaticamente em todas as chamadas que requerem scope.

#### Scenario: Troca de conta ativa
- **WHEN** usuário seleciona outra conta no AccountSwitcher
- **THEN** store atualiza `accountId`, persiste, e queries TanStack Query são invalidadas para refetch com novo scope

#### Scenario: Primeira sessão sem conta selecionada
- **WHEN** usuário autentica e ainda não tem conta ativa salva
- **THEN** sistema chama `GET /accounts`, seleciona primeira conta retornada e persiste

### Requirement: Tipos derivados de OpenAPI
O frontend SHALL gerar tipos TypeScript da API consumindo `/openapi.json` via `openapi-typescript`. O cliente HTTP SHALL ser `openapi-fetch` configurado em `lib/api-client.ts`. NÃO SHALL haver tipos manualmente duplicados de schemas da API.

#### Scenario: Atualização da API
- **WHEN** rota da API ganha campo novo no schema Zod e spec é regenerada
- **THEN** rodar `pnpm gen:api` em `bfin-web` atualiza `lib/api-types.ts`; usos sem o campo passam a ter inferência atualizada sem edits manuais

### Requirement: CRUDs core implementados
O frontend SHALL fornecer interface para todas operações CRUD expostas pela API atual: accounts, account-members, categories, transactions, debts, goals.

#### Scenario: Listagem de transações
- **WHEN** usuário acessa `/transactions` com conta ativa
- **THEN** vê tabela paginada com filtros por data/categoria/tipo, alimentada por `GET /contas/<id>/transacoes`

#### Scenario: Criação de transação
- **WHEN** usuário submete formulário de nova transação válido
- **THEN** `POST /contas/<id>/transacoes` é chamado via proxy; em sucesso a tabela é invalidada e novo item aparece

#### Scenario: Pagamento de parcela de dívida
- **WHEN** usuário aciona "pagar parcela" em uma dívida
- **THEN** `POST /contas/<id>/dividas/<id>/pagar-parcela` é chamado e estado da dívida é refetched

### Requirement: Dashboard com daily limit e projections
O frontend SHALL exibir dashboard inicial com widget de daily limit (`GET /contas/<id>/limite-diario`) e gráfico de projeções (`GET /contas/<id>/projecoes`).

#### Scenario: Carregamento do dashboard
- **WHEN** usuário acessa `/` após login com conta ativa
- **THEN** vê widget de limite diário do dia atual e gráfico Recharts com projeções dos próximos meses

### Requirement: Deploy em app.bfincont.com.br
O frontend SHALL ser deployado como container Node na VPS atual atrás de Caddy, servindo em `https://app.bfincont.com.br`. TLS SHALL ser gerenciado pelo Caddy.

#### Scenario: Acesso público HTTPS
- **WHEN** usuário acessa `https://app.bfincont.com.br`
- **THEN** Caddy termina TLS e faz reverse proxy para o container Next.js, que serve a aplicação

#### Scenario: CI/CD em push para master
- **WHEN** commit é mergeado em `master` do `bfin-web`
- **THEN** pipeline builda imagem, publica em GHCR e VPS pulla nova versão (paridade com fluxo da API)
