# BFIN - Banking Finance

> Sistema inteligente de gerenciamento financeiro pessoal com automação de regras e controle de reservas

---

## Visão Geral

O **BFIN** é uma aplicação de gerenciamento financeiro que funciona como um banco pessoal inteligente, oferecendo:

- **Reserva automática de emergência** (30% de toda receita)
- **Bloqueio preventivo de despesas fixas** (garantindo pagamento futuro)
- **Sugestão inteligente de gastos diários** (baseada em análise preditiva)
- **Controle total de despesas variáveis** (débito imediato)
- **Dashboard com métricas financeiras** (visão 360° da saúde financeira)

---

## Documentação

A documentação do projeto está organizada nos seguintes arquivos:

| Documento | Descrição |
|-----------|-----------|
| **[ESPECIFICACAO_TECNICA.md](./ESPECIFICACAO_TECNICA.md)** | Especificação completa do sistema: arquitetura, requisitos, modelo de dados, fluxos de processo, APIs e regras de negócio |
| **[EXEMPLOS_IMPLEMENTACAO.md](./EXEMPLOS_IMPLEMENTACAO.md)** | Exemplos práticos de código, queries SQL, services TypeScript e configurações |

---

## Principais Funcionalidades

### 1. Gestão de Receitas com Divisão Automática
Toda receita registrada é automaticamente dividida:
- **30%** → Reserva de emergência (bloqueada)
- **70%** → Saldo disponível (para gastos)

```
Exemplo: Salário de R$ 3.000
  ├─ R$ 900  → Reserva de emergência
  └─ R$ 2.100 → Disponível para uso
```

---

### 2. Bloqueio Preventivo de Despesas Fixas
Despesas com data futura (aluguel, condomínio, assinaturas) têm o valor **bloqueado imediatamente**, garantindo disponibilidade na data de vencimento.

```
Exemplo: Aluguel de R$ 500 vence dia 17
  ├─ Dia 5: Valor bloqueado (saldo disponível reduz)
  ├─ Dia 17: Débito efetivado automaticamente
  └─ Próximo mês: Nova instância criada automaticamente
```

---

### 3. Motor de Sugestão de Gastos
Baseado em inteligência de dados, o sistema calcula e sugere quanto você pode gastar por dia:

```
Fórmula:
  1. Base = Saldo Disponível / Dias até próxima receita
  2. Ajustado = Base × 0.9 (margem de segurança 10%)
  3. Limite = MIN(Ajustado, Média Histórica × 1.2)
```

**Exemplo:**
```
Saldo disponível: R$ 2.100
Dias até próximo salário: 30
Limite sugerido: R$ 63/dia
```

---

### 4. Controle de Despesas Variáveis
Gastos do dia a dia (alimentação, transporte, lazer) são debitados imediatamente, com:
- Categorização obrigatória
- Alertas quando excede limite diário
- Histórico detalhado

---

## Stack Tecnológica

### Backend
- **Runtime:** Node.js 20+
- **Framework:** Express.js ou Fastify
- **Linguagem:** TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL 15+
- **Cache:** Redis 7+
- **Validação:** Zod
- **Testes:** Vitest

### Frontend Web
- **Framework:** React 18+
- **Linguagem:** TypeScript
- **State:** Redux Toolkit ou Zustand
- **UI:** TailwindCSS + Shadcn/UI
- **Charts:** Recharts ou Chart.js

### Mobile
- **Framework:** React Native
- **Navigation:** React Navigation
- **State:** Redux Toolkit

---

## Estrutura do Projeto

```
bfin/
├── docs/
│   ├── ESPECIFICACAO_TECNICA.md
│   └── EXEMPLOS_IMPLEMENTACAO.md
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   │   ├── TransactionService.ts
│   │   │   ├── FinancialRulesEngine.ts
│   │   │   ├── SuggestionEngine.ts
│   │   │   └── NotificationService.ts
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── jobs/
│   │   │   └── ExecuteScheduledExpenses.ts
│   │   └── server.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── tests/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── App.tsx
│   └── package.json
├── mobile/
│   └── ...
├── docker-compose.yml
└── README.md
```

---

## Quick Start

### Pré-requisitos
- Node.js 20+
- Docker e Docker Compose
- PostgreSQL 15+ (ou via Docker)
- Redis 7+ (ou via Docker)

### Modo Simplificado (Recomendado)

#### Opção 1: Usando NPM (Mais simples)

**Primeira vez (setup completo):**
```bash
git clone https://github.com/seu-usuario/bfin.git
cd bfin
npm install
npm start
```

**Dias seguintes (rápido):**
```bash
npm run dev
```

**Parar serviços:**
```bash
npm stop
```

#### Opção 2: Usando scripts shell

**Primeira vez (setup completo):**
```bash
./start.sh
```

**Dias seguintes (rápido):**
```bash
./dev.sh
```

**Parar serviços:**
```bash
./stop.sh
```

### Serviços disponíveis após inicialização
- 📊 **Frontend:** http://localhost:5173
- 🔧 **Backend:** http://localhost:3000
- 🗄️ **Adminer:** http://localhost:8080
  - Sistema: PostgreSQL
  - Servidor: postgres
  - Usuário: bfin_user
  - Senha: bfin_pass
  - Base: bfin_dev

---

### Modo Manual (Passo a Passo)

#### 1. Clonar repositório
```bash
git clone https://github.com/seu-usuario/bfin.git
cd bfin
```

#### 2. Subir infraestrutura com Docker
```bash
docker-compose up -d
```

Isso inicia:
- PostgreSQL na porta 5432
- Redis na porta 6379
- Adminer (UI para PostgreSQL) na porta 8080

#### 3. Configurar Backend
```bash
cd backend
npm install
cp .env.example .env
```

Edite `.env` com as credenciais corretas.

```bash
# Executar migrations
npm run db:migrate

# Seed inicial (categorias padrão, etc)
npm run db:seed

# Iniciar servidor de desenvolvimento
npm run dev
```

API estará disponível em `http://localhost:3000`

#### 4. Configurar Frontend
```bash
cd frontend
npm install
npm run dev
```

Interface web em `http://localhost:5173`

---

## Comandos Úteis

### Comandos NPM da Raiz (Gerais)

#### Desenvolvimento
```bash
npm start          # Setup completo (1ª vez): Docker + install + migrations + dev
npm run dev        # Inicia backend + frontend (uso diário)
npm stop           # Para todos os serviços
```

#### Instalação
```bash
npm run install:all       # Instala deps backend + frontend
npm run install:backend   # Instala deps apenas do backend
npm run install:frontend  # Instala deps apenas do frontend
```

#### Docker
```bash
npm run docker:up       # Sobe containers (PostgreSQL, Redis, Adminer)
npm run docker:down     # Para containers
npm run docker:logs     # Ver logs dos containers
npm run docker:ps       # Status dos containers
npm run docker:restart  # Reinicia containers
```

#### Database
```bash
npm run db:setup     # Setup completo: generate + migrate + seed
npm run db:migrate   # Executa migrations
npm run db:seed      # Popula banco com dados iniciais
npm run db:studio    # Abre Prisma Studio (GUI do banco)
npm run db:reset     # Reseta banco (CUIDADO: apaga tudo)
```

#### Build e Testes
```bash
npm run build           # Build backend + frontend
npm run build:backend   # Build apenas backend
npm run build:frontend  # Build apenas frontend
npm test                # Roda testes do backend
npm run test:coverage   # Testes com coverage
npm run lint            # Lint backend + frontend
```

### Backend (dentro de /backend)
```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build
npm run start

# Testes
npm run test
npm run test:coverage

# Prisma Studio (GUI do banco)
npm run db:studio

# Executar cron manualmente
npm run cron:execute-expenses
```

### Database (comandos avançados)
```bash
# Criar nova migration
cd backend && npx prisma migrate dev --name nome_da_migration

# Resetar banco (CUIDADO: apaga tudo)
npm run db:reset

# Acessar PostgreSQL via CLI
docker exec -it bfin_postgres psql -U bfin_user -d bfin_dev
```

### Docker (comandos avançados)
```bash
# Resetar volumes (apaga dados)
docker-compose down -v

# Rebuildar containers
docker-compose up -d --build
```

---

## Endpoints Principais

### Autenticação
```http
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
```

### Contas
```http
GET    /api/v1/accounts
POST   /api/v1/accounts
GET    /api/v1/accounts/:id
PATCH  /api/v1/accounts/:id
```

### Transações
```http
POST   /api/v1/transactions/income
POST   /api/v1/transactions/fixed-expense
POST   /api/v1/transactions/variable-expense
GET    /api/v1/transactions
GET    /api/v1/transactions/:id
PATCH  /api/v1/transactions/:id
DELETE /api/v1/transactions/:id
```

### Sugestões
```http
GET    /api/v1/suggestions/daily-limit?account_id=xxx
GET    /api/v1/suggestions/history?account_id=xxx
```

### Relatórios
```http
GET    /api/v1/reports/monthly?account_id=xxx&month=2026-01
GET    /api/v1/reports/annual?account_id=xxx&year=2026
GET    /api/v1/reports/category-breakdown?account_id=xxx
```

Documentação completa da API: `http://localhost:3000/api-docs` (Swagger)

---

## Regras de Negócio Importantes

### RN001 - Divisão de Receita
- 30% de toda receita vai para reserva de emergência
- 70% fica disponível para gastos
- Aplicação automática e obrigatória

### RN002 - Bloqueio de Despesas Fixas
- Valor bloqueado imediatamente no lançamento
- Débito efetivo apenas na data de vencimento
- Recorrência automática para despesas mensais/anuais

### RN003 - Integridade de Saldos
```
total_balance = available_balance + locked_balance + emergency_reserve
```
Essa invariante é sempre validada em todas as operações.

### RN004 - Cálculo de Limite Diário
- Atualizado após cada transação
- Considera: saldo disponível, despesas bloqueadas, histórico de 90 dias
- Aplica margem de segurança de 10%

Ver todas as regras em: [ESPECIFICACAO_TECNICA.md - Seção 8](./ESPECIFICACAO_TECNICA.md#8-regras-de-negócio-consolidadas)

---

## Segurança

- **Autenticação:** JWT com refresh tokens
- **Criptografia:** AES-256 para dados sensíveis em repouso
- **HTTPS:** Obrigatório em produção (TLS 1.3)
- **Rate Limiting:** 100 req/min por usuário
- **Auditoria:** Log de todas as transações financeiras
- **LGPD:** Compliance com direito ao esquecimento e exportação de dados

Ver detalhes em: [ESPECIFICACAO_TECNICA.md - Seção 10](./ESPECIFICACAO_TECNICA.md#10-considerações-de-segurança)

---

## Testes

### Executar testes
```bash
# Todos os testes
npm run test

# Com interface gráfica
npm run test:ui

# Com coverage
npm run test:coverage
```

### Cobertura mínima
- **Unitários:** > 80%
- **Integração:** > 70%
- **E2E:** Fluxos críticos (receita, despesa fixa, despesa variável)

---

## Roadmap

### ✅ Fase 1 - MVP (Atual)
- [x] Autenticação e gestão de usuários
- [x] Sistema de transações (receitas e despesas)
- [x] Motor de regras financeiras
- [x] Cálculo de sugestão de gastos
- [x] Dashboard básico

### 🔄 Fase 2 - Inteligência (Em desenvolvimento)
- [ ] Algoritmo ML para sugestões avançadas
- [ ] Notificações push (web e mobile)
- [ ] Relatórios e exportação (PDF, CSV)
- [ ] Categorização automática de despesas
- [ ] Gráficos avançados

### 📋 Fase 3 - Mobile
- [ ] App React Native (iOS + Android)
- [ ] Sincronização offline
- [ ] OCR para notas fiscais
- [ ] Integração Open Banking
- [ ] Sistema de metas financeiras

### 🚀 Fase 4 - Enterprise
- [ ] Multi-tenant
- [ ] Planos freemium/premium
- [ ] AI avançada para previsões
- [ ] Marketplace de produtos financeiros

---

## Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### Padrões de Commit
```
feat: adiciona nova funcionalidade
fix: corrige bug
docs: atualiza documentação
test: adiciona ou corrige testes
refactor: refatora código sem mudar comportamento
perf: melhora performance
chore: atualiza dependências, config, etc
```

---

## Licença

Este projeto está sob a licença MIT. Ver arquivo [LICENSE](./LICENSE) para mais detalhes.

---

## Contato

**Autor:** Igor Guariroba

**Projeto:** BFIN - Banking Finance

**Documentação completa:** Ver arquivos `ESPECIFICACAO_TECNICA.md` e `EXEMPLOS_IMPLEMENTACAO.md`

---

## Métricas do Projeto

![GitHub last commit](https://img.shields.io/github/last-commit/seu-usuario/bfin)
![GitHub issues](https://img.shields.io/github/issues/seu-usuario/bfin)
![GitHub](https://img.shields.io/github/license/seu-usuario/bfin)

---

**Desenvolvido com TypeScript, React, Node.js e PostgreSQL**
