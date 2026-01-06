# Fase 1 - MVP (Minimum Viable Product)

> Plano detalhado do que será construído no primeiro momento

---

## Objetivo da Fase 1

Entregar um **produto mínimo viável** com as funcionalidades core operacionais, permitindo que usuários:

1. Criem contas e se autentiquem
2. Registrem receitas com divisão automática (30/70)
3. Agendem despesas fixas com bloqueio preventivo
4. Lancem despesas variáveis com débito imediato
5. Vejam sugestão de limite diário de gastos
6. Visualizem dashboard básico com saldos e transações

**Prazo estimado:** 8-10 semanas
**Equipe:** 2-3 desenvolvedores full-stack

---

## Checklist de Funcionalidades

### 1. Infraestrutura e Setup (Semana 1)

- [ ] Setup do repositório Git
- [ ] Configuração Docker Compose (PostgreSQL + Redis)
- [ ] Setup projeto Backend (Node + TypeScript + Express)
- [ ] Setup projeto Frontend (React + TypeScript + Vite)
- [ ] Configuração Prisma ORM
- [ ] Configuração ESLint + Prettier
- [ ] Setup CI/CD básico (GitHub Actions)
- [ ] Configuração variáveis de ambiente

**Entregável:** Ambiente de desenvolvimento funcionando

---

### 2. Autenticação e Gestão de Usuários (Semana 2)

#### Backend
- [ ] Model `users` no Prisma
- [ ] Migration inicial do banco
- [ ] Service de autenticação (register, login, refresh)
- [ ] Middleware de autenticação JWT
- [ ] Password hashing com bcrypt
- [ ] Rotas:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `GET /api/v1/auth/me`

#### Frontend
- [ ] Tela de registro
- [ ] Tela de login
- [ ] Context de autenticação
- [ ] Proteção de rotas privadas
- [ ] Armazenamento seguro de tokens

**Entregável:** Sistema de autenticação completo

---

### 3. Gestão de Contas (Semana 2)

#### Backend
- [ ] Model `accounts` no Prisma
- [ ] Migration
- [ ] CRUD de contas
- [ ] Validação de integridade de saldos
- [ ] Rotas:
  - `POST /api/v1/accounts` (criar conta)
  - `GET /api/v1/accounts` (listar contas do usuário)
  - `GET /api/v1/accounts/:id` (detalhes)
  - `PATCH /api/v1/accounts/:id` (atualizar nome)

#### Frontend
- [ ] Tela de criação de conta
- [ ] Listagem de contas
- [ ] Seletor de conta ativa

**Entregável:** Usuário pode criar e gerenciar contas

---

### 4. Sistema de Categorias (Semana 3)

#### Backend
- [ ] Model `categories` no Prisma
- [ ] Migration
- [ ] Seed com categorias padrão (Salário, Alimentação, Transporte, etc.)
- [ ] CRUD de categorias customizadas
- [ ] Rotas:
  - `GET /api/v1/categories`
  - `POST /api/v1/categories` (criar categoria customizada)

#### Frontend
- [ ] Seletor de categorias em formulários
- [ ] Tela de gerenciamento de categorias (opcional no MVP)

**Entregável:** Sistema de categorização funcionando

---

### 5. Sistema de Transações - Receitas (Semana 3-4)

#### Backend
- [ ] Model `transactions` no Prisma
- [ ] Model `financial_rules` no Prisma
- [ ] Model `balance_history` no Prisma
- [ ] Migrations
- [ ] `TransactionService.processIncome()`
  - Validação de dados
  - Aplicação da regra 30/70
  - Atualização de saldos (transaction atômica)
  - Registro de histórico
  - Recálculo de sugestão
- [ ] Rotas:
  - `POST /api/v1/transactions/income`
  - `GET /api/v1/transactions?type=income`

#### Frontend
- [ ] Formulário de lançamento de receita
- [ ] Validação client-side
- [ ] Feedback visual da divisão 30/70
- [ ] Listagem de receitas

**Entregável:** Usuário pode registrar receitas e ver divisão automática

---

### 6. Sistema de Transações - Despesas Fixas (Semana 4-5)

#### Backend
- [ ] `TransactionService.createFixedExpense()`
  - Validação de saldo disponível
  - Bloqueio preventivo (available → locked)
  - Registro com status 'locked'
  - Agendamento (cron job)
- [ ] Cron job: `ExecuteScheduledExpenses`
  - Executar às 00:01 diariamente
  - Buscar despesas vencidas
  - Debitar total_balance
  - Liberar locked_balance
  - Atualizar status para 'executed'
  - Criar próxima instância se recorrente
- [ ] Rotas:
  - `POST /api/v1/transactions/fixed-expense`
  - `GET /api/v1/transactions?type=fixed_expense&status=locked`

#### Frontend
- [ ] Formulário de despesa fixa
- [ ] Seletor de data futura
- [ ] Checkbox de recorrência
- [ ] Listagem de despesas agendadas
- [ ] Indicador visual de bloqueio no saldo

**Entregável:** Usuário pode agendar despesas fixas com bloqueio

---

### 7. Sistema de Transações - Despesas Variáveis (Semana 5)

#### Backend
- [ ] `TransactionService.createVariableExpense()`
  - Validação de saldo
  - Débito imediato
  - Registro com status 'executed'
- [ ] Verificação de limite diário excedido
- [ ] Rotas:
  - `POST /api/v1/transactions/variable-expense`
  - `GET /api/v1/transactions?type=variable_expense`

#### Frontend
- [ ] Formulário rápido de despesa
- [ ] Botão de "Gasto rápido" com valor pré-definido
- [ ] Listagem de gastos do dia
- [ ] Alerta visual quando exceder limite

**Entregável:** Usuário pode lançar gastos do dia a dia

---

### 8. Motor de Sugestão de Gastos (Semana 6)

#### Backend
- [ ] Model `spending_suggestions` no Prisma
- [ ] Migration
- [ ] `SuggestionEngine.calculateDailyLimit()`
  - Buscar saldo disponível
  - Calcular dias até próxima receita
  - Buscar média de gastos (90 dias)
  - Aplicar fórmula com fator de segurança
  - Salvar sugestão
  - Cachear no Redis (24h)
- [ ] Trigger: recalcular após cada transação
- [ ] Rotas:
  - `GET /api/v1/suggestions/daily-limit?account_id=xxx`
  - `GET /api/v1/suggestions/history?account_id=xxx`

#### Frontend
- [ ] Card de "Limite Diário" no dashboard
- [ ] Barra de progresso: gasto do dia vs limite
- [ ] Indicador de quanto ainda pode gastar hoje
- [ ] Alertas quando próximo do limite

**Entregável:** Usuário vê sugestão inteligente de quanto gastar por dia

---

### 9. Dashboard Financeiro (Semana 6-7)

#### Backend
- [ ] Endpoint de resumo:
  - `GET /api/v1/dashboard?account_id=xxx`
  - Retorna: saldos, transações recentes, sugestão, próximas despesas
- [ ] Endpoint de métricas:
  - Gastos por categoria (mês atual)
  - Evolução mensal (últimos 6 meses)

#### Frontend
- [ ] Tela principal do Dashboard
- [ ] Cards de saldos:
  - Total
  - Disponível
  - Bloqueado
  - Reserva de emergência
- [ ] Card "Limite Diário"
  - Quanto pode gastar hoje
  - Quanto já gastou
  - Barra de progresso
- [ ] Lista de "Próximas Despesas Fixas"
- [ ] Lista de "Transações Recentes"
- [ ] Gráfico básico: Receitas vs Despesas (últimos 6 meses)
- [ ] Gráfico: Gastos por categoria (mês atual)

**Entregável:** Dashboard com visão 360° da situação financeira

---

### 10. Listagem e Filtros de Transações (Semana 7)

#### Backend
- [ ] Endpoint com filtros avançados:
  - `GET /api/v1/transactions`
  - Query params: type, status, start_date, end_date, category_id, page, limit
- [ ] Paginação
- [ ] Ordenação por data

#### Frontend
- [ ] Tela "Transações"
- [ ] Filtros:
  - Tipo (Receita, Despesa Fixa, Despesa Variável)
  - Período (Hoje, Semana, Mês, Personalizado)
  - Categoria
  - Status
- [ ] Listagem com scroll infinito ou paginação
- [ ] Detalhes da transação (modal)

**Entregável:** Usuário pode filtrar e visualizar todo histórico

---

### 11. Testes (Semana 8)

#### Backend
- [ ] Testes unitários:
  - `TransactionService` (>80% coverage)
  - `SuggestionEngine` (>80% coverage)
  - `FinancialRulesEngine`
- [ ] Testes de integração:
  - Fluxo completo: receita → despesa fixa → despesa variável
  - Validação de integridade de saldos
  - Execução de despesas agendadas (cron)
- [ ] Testes de API (E2E):
  - Autenticação
  - CRUD de transações
  - Cálculo de sugestão

#### Frontend
- [ ] Testes de componentes principais
- [ ] Testes de integração de fluxos críticos

**Entregável:** Cobertura de testes >70%

---

### 12. Documentação e Deploy (Semana 8-9)

#### Documentação
- [x] Especificação técnica completa
- [x] Exemplos de implementação
- [x] README com quick start
- [ ] Swagger/OpenAPI (API docs)
- [ ] Guia de contribuição

#### Deploy
- [ ] Setup servidor (VPS, AWS, Heroku, Railway, etc.)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Variáveis de ambiente de produção
- [ ] Backup automático do PostgreSQL
- [ ] Monitoramento básico (logs, erros)
- [ ] HTTPS configurado

**Entregável:** Aplicação no ar, acessível publicamente

---

## Funcionalidades que NÃO estão no MVP

As seguintes funcionalidades ficam para fases futuras:

- Notificações push/email
- App mobile
- Integração com Open Banking
- Machine Learning avançado
- OCR de notas fiscais
- Relatórios em PDF
- Exportação de dados
- Multi-contas simultâneas
- Transferências entre contas
- Sistema de metas financeiras
- Planejamento de orçamento
- Análise de investimentos

---

## Stack Confirmada para MVP

### Backend
```
- Node.js 20+
- TypeScript 5+
- Express.js 4
- Prisma ORM 5
- PostgreSQL 15
- Redis 7
- JWT (jsonwebtoken)
- Bcrypt
- Zod (validação)
- Node-cron
- Vitest (testes)
```

### Frontend
```
- React 18+
- TypeScript 5+
- Vite
- TailwindCSS 3
- Shadcn/UI (componentes)
- Zustand ou Redux Toolkit (state)
- React Query (cache de API)
- React Hook Form (formulários)
- Zod (validação)
- Recharts (gráficos)
- date-fns (datas)
```

---

## Estrutura de Pastas (MVP)

```
bfin/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── AuthController.ts
│   │   │   ├── AccountController.ts
│   │   │   ├── TransactionController.ts
│   │   │   └── SuggestionController.ts
│   │   ├── services/
│   │   │   ├── AuthService.ts
│   │   │   ├── TransactionService.ts
│   │   │   ├── FinancialRulesEngine.ts
│   │   │   └── SuggestionEngine.ts
│   │   ├── middlewares/
│   │   │   ├── auth.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── rateLimit.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── accounts.routes.ts
│   │   │   ├── transactions.routes.ts
│   │   │   └── suggestions.routes.ts
│   │   ├── jobs/
│   │   │   └── ExecuteScheduledExpenses.ts
│   │   ├── utils/
│   │   ├── types/
│   │   └── server.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── transactions/
│   │   │   └── ui/ (shadcn)
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   └── Transactions.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── hooks/
│   │   ├── contexts/
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── tsconfig.json
│
├── docs/
│   ├── ESPECIFICACAO_TECNICA.md
│   ├── EXEMPLOS_IMPLEMENTACAO.md
│   └── FASE_1_MVP.md
│
├── docker-compose.yml
└── README.md
```

---

## Critérios de Aceitação do MVP

O MVP será considerado completo quando:

1. ✅ Usuário pode se registrar e fazer login
2. ✅ Usuário pode criar uma conta financeira
3. ✅ Usuário pode lançar receita e ver divisão 30/70 aplicada
4. ✅ Usuário pode agendar despesa fixa e ver saldo bloqueado
5. ✅ Sistema executa despesas fixas automaticamente na data de vencimento
6. ✅ Usuário pode lançar despesa variável com débito imediato
7. ✅ Usuário vê sugestão de limite diário atualizada em tempo real
8. ✅ Dashboard exibe todos os saldos corretamente
9. ✅ Integridade de saldos é sempre mantida
10. ✅ Aplicação está no ar e acessível via HTTPS
11. ✅ Cobertura de testes >70%
12. ✅ Documentação completa disponível

---

## Próximos Passos

Após conclusão do MVP:

1. **Coleta de Feedback:** Usuários beta testam a aplicação
2. **Ajustes e Correções:** Bugs e melhorias de UX
3. **Planejamento Fase 2:** Priorização de features (notificações, relatórios, ML)
4. **Início Fase 2:** Desenvolvimento de inteligência avançada

---

## Recursos Necessários

### Equipe
- 2-3 desenvolvedores full-stack (Node + React)
- 1 designer UI/UX (part-time)
- 1 QA/tester (part-time)

### Infraestrutura
- Servidor VPS ou PaaS (Heroku, Railway, Render)
- PostgreSQL gerenciado (Neon, Supabase, ou RDS)
- Redis gerenciado (Upstash, Redis Cloud)
- Domain + SSL (Cloudflare)
- Monitoramento (Sentry free tier)

### Custo estimado mensal (MVP)
- Servidor: $10-20
- Database: $0-10 (free tier)
- Redis: $0 (free tier)
- Domain: $12/ano
- Total: ~$20-30/mês

---

**Este é o plano para o primeiro momento do projeto BFIN.**

Para começar a implementação, consulte:
- [ESPECIFICACAO_TECNICA.md](./ESPECIFICACAO_TECNICA.md) - Detalhes técnicos completos
- [EXEMPLOS_IMPLEMENTACAO.md](./EXEMPLOS_IMPLEMENTACAO.md) - Código de referência
