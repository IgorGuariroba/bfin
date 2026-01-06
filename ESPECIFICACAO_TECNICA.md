# Especificação Técnica - Sistema de Gerenciamento Financeiro Pessoal (BFIN)

> **Versão:** 1.0
> **Data:** 06/01/2026
> **Autor:** Igor Guariroba

---

## 1. Visão Geral

### 1.1 Propósito
O BFIN (Banking Finance) é uma aplicação de gerenciamento financeiro pessoal que funciona como um banco inteligente com automação de regras financeiras, controle automático de reservas e sugestão de limites de gastos baseados em inteligência de dados.

### 1.2 Objetivos
- Automatizar a gestão de reserva de emergência
- Controlar despesas fixas com bloqueio preventivo de saldo
- Gerenciar despesas variáveis em tempo real
- Sugerir limites de gastos diários baseados em análise preditiva
- Proporcionar visibilidade completa da saúde financeira do usuário

### 1.3 Escopo
- ✅ Gestão de contas e transações
- ✅ Sistema de regras financeiras automatizadas
- ✅ Reserva de emergência automática
- ✅ Bloqueio e agendamento de despesas fixas
- ✅ Motor de sugestão de gastos
- ✅ Dashboard com métricas financeiras
- 🔄 Integração com Open Banking (Fase 2)
- 🔄 Machine Learning para previsões (Fase 2)

---

## 2. Requisitos Funcionais

### RF001 - Gestão de Receitas
**Prioridade:** Alta
**Descrição:** O sistema deve processar receitas aplicando automaticamente a regra de divisão 30/70.

**Critérios de Aceitação:**
- Ao registrar uma receita, 30% deve ser automaticamente movido para reserva de emergência
- 70% deve ser adicionado ao saldo disponível
- O histórico completo da divisão deve ser registrado
- Deve suportar receitas recorrentes (salário mensal, renda passiva)

**Regras de Negócio:**
- RN001: Percentual fixo de 30% para reserva (configurável por usuário em versões futuras)
- RN002: A divisão ocorre automaticamente no momento do lançamento
- RN003: Receitas recorrentes são processadas automaticamente na data configurada

---

### RF002 - Gestão de Despesas Fixas
**Prioridade:** Alta
**Descrição:** O sistema deve gerenciar despesas fixas com bloqueio preventivo e execução agendada.

**Critérios de Aceitação:**
- Ao cadastrar despesa fixa com data futura, o valor deve ser bloqueado imediatamente
- O saldo disponível deve ser reduzido pelo valor bloqueado
- Na data de vencimento, a despesa deve ser efetivamente debitada
- Após execução, o valor deve ser liberado do saldo bloqueado
- Deve suportar despesas recorrentes (aluguel, condomínio, assinaturas)

**Regras de Negócio:**
- RN004: Bloqueio ocorre imediatamente no lançamento
- RN005: Débito efetivo só acontece na data de vencimento
- RN006: Despesas recorrentes são recriadas automaticamente
- RN007: Sistema deve alertar sobre vencimentos próximos (3 dias antes)

---

### RF003 - Gestão de Despesas Variáveis
**Prioridade:** Alta
**Descrição:** O sistema deve processar despesas variáveis com débito imediato.

**Critérios de Aceitação:**
- Ao registrar despesa variável, débito imediato do saldo total e disponível
- Categorização obrigatória da despesa
- Atualização imediata do limite diário sugerido
- Histórico detalhado com data, hora e categoria

**Regras de Negócio:**
- RN008: Débito instantâneo no lançamento
- RN009: Não permite despesa maior que saldo disponível
- RN010: Categorias predefinidas: Alimentação, Transporte, Lazer, Saúde, Educação, Outros

---

### RF004 - Motor de Sugestão de Gastos
**Prioridade:** Alta
**Descrição:** O sistema deve calcular e sugerir um limite de gasto diário otimizado.

**Critérios de Aceitação:**
- Cálculo baseado em saldo disponível, despesas bloqueadas e histórico
- Atualização em tempo real a cada transação
- Projeção para os próximos 30 dias
- Alertas quando gastos do dia excedem a sugestão

**Regras de Negócio:**
- RN011: Fórmula base: `(Saldo Disponível - Despesas Fixas Bloqueadas) / Dias até próxima receita`
- RN012: Considera média de despesas variáveis dos últimos 90 dias
- RN013: Aplica fator de segurança de 10% (gasta menos que o calculado)
- RN014: Recalcula automaticamente a cada transação

---

### RF005 - Dashboard Financeiro
**Prioridade:** Média
**Descrição:** Interface visual com indicadores da saúde financeira.

**Critérios de Aceitação:**
- Exibição de saldo total, disponível, bloqueado e reserva
- Gráficos de evolução mensal
- Comparativo de gastos por categoria
- Projeção de fim de mês
- Lista de próximas despesas fixas

---

### RF006 - Relatórios e Exportação
**Prioridade:** Baixa
**Descrição:** Geração de relatórios e exportação de dados.

**Critérios de Aceitação:**
- Exportação em CSV e PDF
- Relatório mensal de receitas e despesas
- Relatório anual para declaração de imposto de renda
- Análise de gastos por categoria e período

---

## 3. Requisitos Não-Funcionais

### RNF001 - Performance
- Tempo de resposta da API: < 200ms para 95% das requisições
- Cálculo de limite diário: < 100ms
- Suporte para até 10.000 transações por conta sem degradação

### RNF002 - Disponibilidade
- SLA de 99.5% de uptime
- Backups diários automáticos
- Recuperação de desastres em até 4 horas

### RNF003 - Segurança
- Autenticação JWT com refresh tokens
- Criptografia de dados sensíveis em repouso (AES-256)
- HTTPS obrigatório em todas as comunicações
- Rate limiting: 100 requisições/minuto por usuário
- Logs de auditoria para todas as transações financeiras

### RNF004 - Escalabilidade
- Arquitetura preparada para escalonamento horizontal
- Cache com Redis para cálculos frequentes
- Banco de dados com particionamento por usuário

### RNF005 - Usabilidade
- Interface responsiva (mobile-first)
- Tempo de aprendizado < 15 minutos
- Acessibilidade WCAG 2.1 nível AA

### RNF006 - Manutenibilidade
- Cobertura de testes > 80%
- Documentação de API com OpenAPI/Swagger
- Logs estruturados (JSON)
- Monitoramento com métricas de negócio

---

## 4. Arquitetura do Sistema

### 4.1 Visão Geral
```
┌─────────────────┐
│   Web Client    │
│  (React + TS)   │
└────────┬────────┘
         │
┌────────┴────────┐
│  Mobile Client  │
│ (React Native)  │
└────────┬────────┘
         │
         │ HTTPS/REST
         │
┌────────┴────────────────────────────────┐
│           API Gateway                    │
│         (Rate Limiting +                 │
│          Authentication)                 │
└────────┬────────────────────────────────┘
         │
┌────────┴────────────────────────────────┐
│        Backend API (Node.js)             │
│                                          │
│  ┌──────────┐  ┌──────────────────┐     │
│  │  Auth    │  │  Transactions    │     │
│  │ Service  │  │     Service      │     │
│  └──────────┘  └──────────────────┘     │
│                                          │
│  ┌──────────┐  ┌──────────────────┐     │
│  │  Rules   │  │   Suggestions    │     │
│  │ Engine   │  │     Engine       │     │
│  └──────────┘  └──────────────────┘     │
└────────┬────────────────────┬───────────┘
         │                    │
    ┌────┴─────┐         ┌────┴─────┐
    │PostgreSQL│         │  Redis   │
    │  (Main)  │         │ (Cache)  │
    └──────────┘         └──────────┘
```

### 4.2 Camadas da Aplicação

#### 4.2.1 Camada de Apresentação
- **Web:** React 18+ com TypeScript
- **Mobile:** React Native com TypeScript
- **State Management:** Redux Toolkit ou Zustand
- **UI Components:** Material-UI ou TailwindCSS

#### 4.2.2 Camada de API
- **Framework:** Express.js ou Fastify
- **Validação:** Zod ou Joi
- **Autenticação:** Passport.js com JWT
- **Documentação:** Swagger/OpenAPI 3.0

#### 4.2.3 Camada de Negócio
- **Transaction Service:** Gestão de transações (CRUD + validações)
- **Rules Engine:** Processamento de regras financeiras
- **Suggestion Engine:** Cálculo de limites e projeções
- **Notification Service:** Alertas e lembretes

#### 4.2.4 Camada de Dados
- **PostgreSQL:** Dados transacionais e mestre
- **Redis:** Cache de cálculos e sessões
- **S3/MinIO:** Armazenamento de documentos e comprovantes

---

## 5. Modelo de Dados

### 5.1 Diagrama Entidade-Relacionamento

```sql
-- ====================================
-- USUÁRIOS E AUTENTICAÇÃO
-- ====================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false
);

CREATE INDEX idx_users_email ON users(email);

-- ====================================
-- CONTAS FINANCEIRAS
-- ====================================

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  account_name VARCHAR(100) NOT NULL,
  account_type VARCHAR(50) DEFAULT 'checking', -- checking, savings, investment

  -- Saldos
  total_balance DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
  available_balance DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
  locked_balance DECIMAL(15,2) DEFAULT 0.00 NOT NULL,
  emergency_reserve DECIMAL(15,2) DEFAULT 0.00 NOT NULL,

  -- Configurações
  currency VARCHAR(3) DEFAULT 'BRL',
  is_default BOOLEAN DEFAULT false,

  -- Auditoria
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT positive_balances CHECK (
    total_balance >= 0 AND
    available_balance >= 0 AND
    locked_balance >= 0 AND
    emergency_reserve >= 0
  ),

  CONSTRAINT balance_integrity CHECK (
    total_balance = available_balance + locked_balance + emergency_reserve
  )
);

CREATE INDEX idx_accounts_user ON accounts(user_id);
CREATE INDEX idx_accounts_default ON accounts(user_id, is_default);

-- ====================================
-- CATEGORIAS
-- ====================================

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL, -- income, expense
  color VARCHAR(7), -- hex color
  icon VARCHAR(50),
  is_system BOOLEAN DEFAULT false, -- categorias do sistema não podem ser deletadas
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_user_type ON categories(user_id, type);

-- Categorias padrão do sistema
INSERT INTO categories (name, type, is_system, color, icon) VALUES
  ('Salário', 'income', true, '#4CAF50', 'work'),
  ('Freelance', 'income', true, '#8BC34A', 'business'),
  ('Investimentos', 'income', true, '#CDDC39', 'trending_up'),
  ('Alimentação', 'expense', true, '#FF5722', 'restaurant'),
  ('Transporte', 'expense', true, '#2196F3', 'directions_car'),
  ('Moradia', 'expense', true, '#9C27B0', 'home'),
  ('Saúde', 'expense', true, '#F44336', 'local_hospital'),
  ('Educação', 'expense', true, '#3F51B5', 'school'),
  ('Lazer', 'expense', true, '#FF9800', 'beach_access'),
  ('Outros', 'expense', true, '#607D8B', 'more_horiz');

-- ====================================
-- TRANSAÇÕES
-- ====================================

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Tipo e Valores
  type VARCHAR(20) NOT NULL, -- income, fixed_expense, variable_expense
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,

  -- Datas
  due_date DATE NOT NULL, -- data de vencimento/recebimento
  executed_date DATE, -- data de execução efetiva
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, executed, cancelled, locked

  -- Recorrência
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern VARCHAR(20), -- monthly, weekly, yearly
  recurrence_end_date DATE,
  parent_transaction_id UUID REFERENCES transactions(id),

  -- Metadados
  tags TEXT[], -- array de tags para busca
  attachment_url TEXT, -- comprovante ou nota fiscal
  notes TEXT,

  CONSTRAINT positive_amount CHECK (amount > 0),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'executed', 'cancelled', 'locked'))
);

CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_due_date ON transactions(due_date);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_category ON transactions(category_id);

-- ====================================
-- REGRAS FINANCEIRAS
-- ====================================

CREATE TABLE financial_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,

  -- Tipo de regra
  rule_type VARCHAR(50) NOT NULL, -- emergency_reserve, auto_investment, smart_saving
  rule_name VARCHAR(100) NOT NULL,

  -- Configuração
  percentage DECIMAL(5,2), -- percentual aplicado
  fixed_amount DECIMAL(15,2), -- valor fixo
  condition_json JSONB, -- condições complexas em JSON

  -- Prioridade e Status
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,

  -- Auditoria
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT valid_percentage CHECK (percentage >= 0 AND percentage <= 100)
);

CREATE INDEX idx_rules_account_active ON financial_rules(account_id, is_active);

-- Regra padrão de reserva de emergência
INSERT INTO financial_rules (account_id, rule_type, rule_name, percentage, priority)
SELECT
  id,
  'emergency_reserve',
  'Reserva de Emergência Automática',
  30.00,
  1
FROM accounts;

-- ====================================
-- HISTÓRICO DE SALDOS (para auditoria e gráficos)
-- ====================================

CREATE TABLE balance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,

  -- Snapshot dos saldos
  total_balance DECIMAL(15,2) NOT NULL,
  available_balance DECIMAL(15,2) NOT NULL,
  locked_balance DECIMAL(15,2) NOT NULL,
  emergency_reserve DECIMAL(15,2) NOT NULL,

  -- Metadados
  change_reason VARCHAR(100), -- income_received, expense_paid, rule_applied
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_balance_history_account_date ON balance_history(account_id, recorded_at);

-- ====================================
-- SUGESTÕES DE GASTOS
-- ====================================

CREATE TABLE spending_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,

  -- Período da sugestão
  suggestion_date DATE NOT NULL,
  valid_until DATE NOT NULL,

  -- Valores calculados
  daily_limit DECIMAL(15,2) NOT NULL,
  monthly_projection DECIMAL(15,2) NOT NULL,

  -- Contexto do cálculo
  available_balance_snapshot DECIMAL(15,2) NOT NULL,
  locked_balance_snapshot DECIMAL(15,2) NOT NULL,
  days_until_next_income INTEGER NOT NULL,
  average_daily_expense DECIMAL(15,2),

  -- Metadados
  calculation_metadata JSONB, -- detalhes do algoritmo
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_suggestions_account_date ON spending_suggestions(account_id, suggestion_date);

-- ====================================
-- ALERTAS E NOTIFICAÇÕES
-- ====================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Tipo e conteúdo
  notification_type VARCHAR(50) NOT NULL, -- expense_due, limit_exceeded, low_balance
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,

  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,

  -- Referências
  related_transaction_id UUID REFERENCES transactions(id),

  -- Auditoria
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);
```

### 5.2 Relacionamentos Principais

```
users (1) ──── (N) accounts
accounts (1) ──── (N) transactions
accounts (1) ──── (N) financial_rules
accounts (1) ──── (N) spending_suggestions
categories (1) ──── (N) transactions
transactions (1) ──── (N) balance_history
```

---

## 6. Fluxos de Processo

### 6.1 Fluxo: Processamento de Receita

```
┌─────────────────────────────────────────┐
│ 1. Usuário lança receita                │
│    - Valor: R$ 3.000                    │
│    - Data: 05/01                        │
│    - Categoria: Salário                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 2. Sistema aplica regra 30/70           │
│    - 30% → Reserva: R$ 900              │
│    - 70% → Disponível: R$ 2.100         │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 3. Atualiza saldos da conta             │
│    - total_balance += R$ 3.000          │
│    - emergency_reserve += R$ 900        │
│    - available_balance += R$ 2.100      │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 4. Registra transação                   │
│    - status: executed                   │
│    - type: income                       │
│    - executed_date: hoje                │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 5. Salva snapshot no histórico          │
│    - balance_history                    │
│    - change_reason: income_received     │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 6. Recalcula limite diário              │
│    - Chama Suggestion Engine            │
│    - Atualiza spending_suggestions      │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 7. Notifica usuário                     │
│    - "Receita processada com sucesso"   │
│    - "Novo limite diário: R$ 70/dia"    │
└──────────────────────────────────────────┘
```

**Pseudocódigo:**
```javascript
async function processIncome(accountId, amount, description, categoryId) {
  // 1. Buscar regras ativas
  const rules = await getRulesByAccount(accountId);
  const emergencyRule = rules.find(r => r.rule_type === 'emergency_reserve');

  // 2. Calcular divisão
  const reserveAmount = amount * (emergencyRule.percentage / 100);
  const availableAmount = amount - reserveAmount;

  // 3. Atualizar conta
  await updateAccount(accountId, {
    total_balance: { increment: amount },
    emergency_reserve: { increment: reserveAmount },
    available_balance: { increment: availableAmount }
  });

  // 4. Criar transação
  const transaction = await createTransaction({
    account_id: accountId,
    type: 'income',
    amount: amount,
    description: description,
    category_id: categoryId,
    due_date: new Date(),
    executed_date: new Date(),
    status: 'executed'
  });

  // 5. Registrar histórico
  await createBalanceSnapshot(accountId, transaction.id, 'income_received');

  // 6. Recalcular sugestão
  await calculateDailyLimit(accountId);

  // 7. Notificar
  await createNotification(accountId, {
    type: 'income_received',
    title: 'Receita processada',
    message: `R$ ${amount} recebido. Reserva: R$ ${reserveAmount}, Disponível: R$ ${availableAmount}`
  });

  return transaction;
}
```

---

### 6.2 Fluxo: Lançamento de Despesa Fixa

```
┌─────────────────────────────────────────┐
│ 1. Usuário lança despesa fixa          │
│    - Valor: R$ 500                      │
│    - Data vencimento: 17/01             │
│    - Categoria: Aluguel                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 2. Valida saldo disponível              │
│    - available_balance >= R$ 500?       │
│    - Se NÃO → Erro: Saldo insuficiente  │
└──────────────┬───────────────────────────┘
               │ SIM
               ▼
┌──────────────────────────────────────────┐
│ 3. Bloqueia saldo preventivamente       │
│    - available_balance -= R$ 500        │
│    - locked_balance += R$ 500           │
│    - total_balance (sem alteração)      │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 4. Cria transação com status "locked"   │
│    - status: locked                     │
│    - type: fixed_expense                │
│    - due_date: 17/01                    │
│    - executed_date: null                │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 5. Agenda execução para data futura     │
│    - Cron job ou scheduler              │
│    - Executa em 17/01 às 00:01          │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 6. Recalcula limite diário              │
│    - Desconta R$ 500 do cálculo         │
│    - Novo limite: R$ 60/dia (exemplo)   │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 7. Notifica usuário                     │
│    - "Despesa agendada para 17/01"      │
│    - "R$ 500 bloqueados"                │
└──────────────────────────────────────────┘

═══════════════════════════════════════════
        NO DIA 17/01 (vencimento)
═══════════════════════════════════════════

┌──────────────────────────────────────────┐
│ 8. Cron executa despesa agendada        │
│    - Busca transactions com:            │
│      status='locked' AND due_date=hoje  │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 9. Efetiva o débito                     │
│    - total_balance -= R$ 500            │
│    - locked_balance -= R$ 500           │
│    - (available já estava descontado)   │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 10. Atualiza status da transação        │
│     - status: executed                  │
│     - executed_date: 17/01              │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 11. Se é recorrente, cria próxima       │
│     - Copia transação para próximo mês  │
│     - due_date: 17/02                   │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 12. Notifica usuário                    │
│     - "Aluguel pago: R$ 500"            │
└──────────────────────────────────────────┘
```

**Pseudocódigo:**
```javascript
async function createFixedExpense(accountId, amount, dueDate, description, categoryId, isRecurring) {
  // 1. Validar saldo
  const account = await getAccount(accountId);
  if (account.available_balance < amount) {
    throw new Error('Saldo insuficiente');
  }

  // 2. Bloquear saldo
  await updateAccount(accountId, {
    available_balance: { decrement: amount },
    locked_balance: { increment: amount }
  });

  // 3. Criar transação bloqueada
  const transaction = await createTransaction({
    account_id: accountId,
    type: 'fixed_expense',
    amount: amount,
    description: description,
    category_id: categoryId,
    due_date: dueDate,
    status: 'locked',
    is_recurring: isRecurring
  });

  // 4. Agendar execução
  await scheduleExpenseExecution(transaction.id, dueDate);

  // 5. Recalcular limite
  await calculateDailyLimit(accountId);

  // 6. Notificar
  await createNotification(accountId, {
    type: 'expense_scheduled',
    title: 'Despesa agendada',
    message: `${description}: R$ ${amount} agendado para ${dueDate}`
  });

  return transaction;
}

// Função executada pelo cron no dia do vencimento
async function executeScheduledExpense(transactionId) {
  const transaction = await getTransaction(transactionId);

  // 1. Debitar saldo total
  await updateAccount(transaction.account_id, {
    total_balance: { decrement: transaction.amount },
    locked_balance: { decrement: transaction.amount }
  });

  // 2. Atualizar status
  await updateTransaction(transactionId, {
    status: 'executed',
    executed_date: new Date()
  });

  // 3. Criar histórico
  await createBalanceSnapshot(transaction.account_id, transactionId, 'expense_paid');

  // 4. Se recorrente, criar próxima
  if (transaction.is_recurring) {
    await createRecurringInstance(transaction);
  }

  // 5. Notificar
  await createNotification(transaction.account_id, {
    type: 'expense_executed',
    title: 'Despesa paga',
    message: `${transaction.description}: R$ ${transaction.amount} debitado`
  });
}
```

---

### 6.3 Fluxo: Lançamento de Despesa Variável

```
┌─────────────────────────────────────────┐
│ 1. Usuário lança despesa variável      │
│    - Valor: R$ 50                       │
│    - Categoria: Alimentação             │
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 2. Valida saldo disponível              │
│    - available_balance >= R$ 50?        │
└──────────────┬───────────────────────────┘
               │ SIM
               ▼
┌──────────────────────────────────────────┐
│ 3. Débito imediato                      │
│    - total_balance -= R$ 50             │
│    - available_balance -= R$ 50         │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 4. Cria transação executada             │
│    - status: executed                   │
│    - type: variable_expense             │
│    - executed_date: hoje                │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 5. Recalcula limite diário              │
│    - Atualiza projeção                  │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 6. Verifica se excedeu limite           │
│    - Gasto do dia > Limite sugerido?    │
└──────────────┬───────────────────────────┘
               │ SIM
               ▼
┌──────────────────────────────────────────┐
│ 7. Alerta de limite excedido            │
│    - "Atenção: você gastou 120% do      │
│       limite diário sugerido"           │
└──────────────────────────────────────────┘
```

**Pseudocódigo:**
```javascript
async function createVariableExpense(accountId, amount, description, categoryId) {
  // 1. Validar saldo
  const account = await getAccount(accountId);
  if (account.available_balance < amount) {
    throw new Error('Saldo insuficiente');
  }

  // 2. Débito imediato
  await updateAccount(accountId, {
    total_balance: { decrement: amount },
    available_balance: { decrement: amount }
  });

  // 3. Criar transação
  const transaction = await createTransaction({
    account_id: accountId,
    type: 'variable_expense',
    amount: amount,
    description: description,
    category_id: categoryId,
    due_date: new Date(),
    executed_date: new Date(),
    status: 'executed'
  });

  // 4. Histórico
  await createBalanceSnapshot(accountId, transaction.id, 'expense_paid');

  // 5. Recalcular
  await calculateDailyLimit(accountId);

  // 6. Verificar alertas
  const dailyExpenses = await getTodayExpenses(accountId);
  const suggestion = await getCurrentSuggestion(accountId);

  if (dailyExpenses > suggestion.daily_limit) {
    await createNotification(accountId, {
      type: 'limit_exceeded',
      title: 'Limite diário excedido',
      message: `Você gastou R$ ${dailyExpenses} hoje. Limite sugerido: R$ ${suggestion.daily_limit}`
    });
  }

  return transaction;
}
```

---

### 6.4 Fluxo: Cálculo de Limite Diário

```
┌─────────────────────────────────────────┐
│ 1. Trigger: Nova transação              │
│    - Receita, despesa ou alteração      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 2. Coleta dados da conta                │
│    - available_balance                  │
│    - locked_balance                     │
│    - emergency_reserve                  │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 3. Calcula dias até próxima receita     │
│    - Busca próxima transação income     │
│    - Se não houver: assume 30 dias      │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 4. Calcula média de gastos histórica    │
│    - Últimos 90 dias                    │
│    - Média diária de variable_expense   │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 5. Aplica fórmula                       │
│                                          │
│  base = (available_balance) /           │
│         (days_until_next_income)        │
│                                          │
│  adjusted = base * 0.9                  │
│            (fator de segurança 10%)     │
│                                          │
│  daily_limit = MIN(adjusted,            │
│                     avg_daily * 1.2)    │
│            (não excede 120% da média)   │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 6. Salva sugestão                       │
│    - spending_suggestions table         │
│    - valid_until: próxima receita       │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ 7. Atualiza cache (Redis)               │
│    - Key: suggestion:{accountId}        │
│    - TTL: 24 horas                      │
└──────────────────────────────────────────┘
```

**Pseudocódigo:**
```javascript
async function calculateDailyLimit(accountId) {
  // 1. Buscar dados da conta
  const account = await getAccount(accountId);

  // 2. Calcular dias até próxima receita
  const nextIncome = await getNextIncome(accountId);
  const daysUntilIncome = nextIncome
    ? differenceInDays(nextIncome.due_date, new Date())
    : 30; // default

  // 3. Buscar média histórica (últimos 90 dias)
  const avgDailyExpense = await getAverageDailyExpense(accountId, 90);

  // 4. Cálculo base
  const baseLimit = account.available_balance / daysUntilIncome;

  // 5. Aplicar fator de segurança (10%)
  const adjustedLimit = baseLimit * 0.9;

  // 6. Limitar a no máximo 120% da média histórica
  const finalLimit = Math.min(adjustedLimit, avgDailyExpense * 1.2);

  // 7. Projeção mensal
  const monthlyProjection = finalLimit * 30;

  // 8. Salvar sugestão
  const suggestion = await createSpendingSuggestion({
    account_id: accountId,
    suggestion_date: new Date(),
    valid_until: nextIncome?.due_date || addDays(new Date(), 30),
    daily_limit: finalLimit,
    monthly_projection: monthlyProjection,
    available_balance_snapshot: account.available_balance,
    locked_balance_snapshot: account.locked_balance,
    days_until_next_income: daysUntilIncome,
    average_daily_expense: avgDailyExpense,
    calculation_metadata: {
      base_limit: baseLimit,
      safety_factor: 0.9,
      historical_cap: avgDailyExpense * 1.2
    }
  });

  // 9. Cachear no Redis
  await redis.setex(
    `suggestion:${accountId}`,
    86400, // 24 horas
    JSON.stringify(suggestion)
  );

  return suggestion;
}
```

---

## 7. Endpoints da API

### 7.1 Autenticação

#### POST /api/v1/auth/register
Registra novo usuário.

**Request:**
```json
{
  "email": "usuario@email.com",
  "password": "senha123",
  "full_name": "João Silva"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "usuario@email.com",
    "full_name": "João Silva"
  },
  "tokens": {
    "access_token": "jwt...",
    "refresh_token": "jwt...",
    "expires_in": 3600
  }
}
```

---

#### POST /api/v1/auth/login
Autentica usuário.

**Request:**
```json
{
  "email": "usuario@email.com",
  "password": "senha123"
}
```

**Response (200):**
```json
{
  "user": { ... },
  "tokens": { ... }
}
```

---

### 7.2 Contas

#### GET /api/v1/accounts
Lista contas do usuário autenticado.

**Headers:** `Authorization: Bearer {token}`

**Response (200):**
```json
{
  "accounts": [
    {
      "id": "uuid",
      "account_name": "Conta Principal",
      "total_balance": 5000.00,
      "available_balance": 3200.00,
      "locked_balance": 800.00,
      "emergency_reserve": 1000.00,
      "is_default": true
    }
  ]
}
```

---

#### POST /api/v1/accounts
Cria nova conta.

**Request:**
```json
{
  "account_name": "Conta Investimentos",
  "account_type": "investment"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "account_name": "Conta Investimentos",
  "total_balance": 0.00,
  ...
}
```

---

### 7.3 Transações

#### POST /api/v1/transactions/income
Registra receita.

**Request:**
```json
{
  "account_id": "uuid",
  "amount": 3000.00,
  "description": "Salário Dezembro",
  "category_id": "uuid",
  "due_date": "2026-01-05",
  "is_recurring": true,
  "recurrence_pattern": "monthly"
}
```

**Response (201):**
```json
{
  "transaction": {
    "id": "uuid",
    "type": "income",
    "amount": 3000.00,
    "status": "executed",
    ...
  },
  "account_update": {
    "total_balance": 8000.00,
    "available_balance": 5300.00,
    "emergency_reserve": 1900.00
  },
  "suggestion": {
    "daily_limit": 176.67,
    "monthly_projection": 5300.00
  }
}
```

---

#### POST /api/v1/transactions/fixed-expense
Registra despesa fixa.

**Request:**
```json
{
  "account_id": "uuid",
  "amount": 500.00,
  "description": "Aluguel Janeiro",
  "category_id": "uuid",
  "due_date": "2026-01-17",
  "is_recurring": true,
  "recurrence_pattern": "monthly"
}
```

**Response (201):**
```json
{
  "transaction": {
    "id": "uuid",
    "type": "fixed_expense",
    "amount": 500.00,
    "status": "locked",
    "due_date": "2026-01-17"
  },
  "account_update": {
    "available_balance": 4800.00,
    "locked_balance": 500.00
  }
}
```

---

#### POST /api/v1/transactions/variable-expense
Registra despesa variável.

**Request:**
```json
{
  "account_id": "uuid",
  "amount": 50.00,
  "description": "Almoço",
  "category_id": "uuid"
}
```

**Response (201):**
```json
{
  "transaction": {
    "id": "uuid",
    "type": "variable_expense",
    "amount": 50.00,
    "status": "executed"
  },
  "account_update": {
    "total_balance": 7950.00,
    "available_balance": 4750.00
  },
  "daily_spent": 120.00,
  "daily_limit": 176.67,
  "alert": null
}
```

---

#### GET /api/v1/transactions
Lista transações com filtros.

**Query Params:**
- `account_id` (required)
- `type` (optional): income, fixed_expense, variable_expense
- `status` (optional): pending, executed, locked, cancelled
- `start_date` (optional)
- `end_date` (optional)
- `category_id` (optional)
- `page` (default: 1)
- `limit` (default: 50)

**Response (200):**
```json
{
  "transactions": [...],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_items": 230,
    "items_per_page": 50
  }
}
```

---

### 7.4 Sugestões

#### GET /api/v1/suggestions/daily-limit
Obtém sugestão de limite diário atual.

**Query:** `?account_id=uuid`

**Response (200):**
```json
{
  "suggestion_date": "2026-01-06",
  "valid_until": "2026-02-05",
  "daily_limit": 176.67,
  "monthly_projection": 5300.00,
  "days_until_next_income": 30,
  "today_spent": 120.00,
  "remaining_today": 56.67,
  "status": "within_limit",
  "metadata": {
    "available_balance": 4750.00,
    "locked_balance": 500.00,
    "average_daily_expense": 150.00
  }
}
```

---

### 7.5 Relatórios

#### GET /api/v1/reports/monthly
Relatório mensal consolidado.

**Query:** `?account_id=uuid&month=2026-01`

**Response (200):**
```json
{
  "period": "2026-01",
  "summary": {
    "total_income": 3000.00,
    "total_expenses": 2450.00,
    "balance": 550.00,
    "emergency_reserve_growth": 900.00
  },
  "expenses_by_category": [
    {
      "category": "Moradia",
      "amount": 1200.00,
      "percentage": 48.98
    },
    {
      "category": "Alimentação",
      "amount": 800.00,
      "percentage": 32.65
    }
  ],
  "daily_average": {
    "income": 100.00,
    "expense": 81.67
  }
}
```

---

## 8. Regras de Negócio Consolidadas

### RN001 - Divisão Automática de Receita
- **Percentual fixo:** 30% para reserva de emergência, 70% para saldo disponível
- **Aplicação:** Automática no momento do lançamento da receita
- **Configurável:** Não (em v1.0, será configurável em versões futuras)

### RN002 - Bloqueio de Despesas Fixas
- **Momento:** Imediato no lançamento da despesa
- **Efeito:** Reduz saldo disponível, aumenta saldo bloqueado
- **Liberação:** Apenas na data de vencimento, após débito efetivo

### RN003 - Execução de Despesas Fixas
- **Data:** Exatamente no dia do vencimento (00:01 AM)
- **Processo:** Debita saldo total, libera saldo bloqueado, marca como executada
- **Recorrência:** Se configurado, cria automaticamente a próxima instância

### RN004 - Débito de Despesas Variáveis
- **Momento:** Imediato no lançamento
- **Validação:** Rejeita se saldo disponível insuficiente
- **Efeito:** Reduz saldo total e disponível simultaneamente

### RN005 - Cálculo de Limite Diário
- **Fórmula:**
  ```
  base = disponível / dias_até_próxima_receita
  ajustado = base * 0.9 (fator de segurança)
  limite = MIN(ajustado, média_histórica * 1.2)
  ```
- **Atualização:** Após cada transação
- **Válido até:** Próxima receita ou 30 dias

### RN006 - Alertas de Limite
- **Trigger:** Gastos do dia > limite sugerido
- **Ação:** Notificação push/email
- **Níveis:**
  - 80-100%: Aviso amarelo
  - 100-120%: Alerta laranja
  - >120%: Alerta vermelho

### RN007 - Integridade de Saldos
- **Invariante:** `total_balance = available + locked + emergency_reserve`
- **Validação:** Constraint no banco + validação em cada transação
- **Erro:** Rejeita qualquer operação que quebre a integridade

### RN008 - Recorrência de Transações
- **Padrões:** Mensal, semanal, anual
- **Criação:** Automática 1 dia após execução da anterior
- **Cancelamento:** Usuário pode cancelar instância específica ou série completa

### RN009 - Histórico Imutável
- **Transações executadas:** Não podem ser editadas
- **Correção:** Criar transação de ajuste (estorno)
- **Auditoria:** Todos os snapshots de saldo são mantidos permanentemente

### RN010 - Prioridade de Regras
- **Ordem de aplicação:**
  1. Validações de saldo
  2. Regras de divisão (reserva)
  3. Bloqueios/débitos
  4. Recálculo de sugestões
  5. Notificações

---

## 9. Casos de Uso Detalhados

### CU001 - Usuário Recebe Salário Mensal

**Ator:** Usuário
**Pré-condições:** Conta criada e ativa
**Fluxo Principal:**
1. Usuário acessa tela de "Nova Receita"
2. Seleciona categoria "Salário"
3. Informa valor R$ 3.000
4. Define data de recebimento: 05/01
5. Marca como "Recorrente - Mensal"
6. Confirma lançamento
7. Sistema aplica regra 30/70 automaticamente
8. Sistema exibe:
   - Reserva de emergência: +R$ 900 (total: R$ 1.900)
   - Disponível: +R$ 2.100 (total: R$ 5.300)
   - Novo limite diário: R$ 176/dia

**Pós-condições:**
- Receita registrada e executada
- Saldos atualizados
- Próxima receita agendada para 05/02

---

### CU002 - Usuário Agenda Aluguel do Mês

**Ator:** Usuário
**Pré-condições:** Receita já recebida, saldo disponível > valor do aluguel
**Fluxo Principal:**
1. Usuário acessa "Nova Despesa Fixa"
2. Seleciona categoria "Moradia"
3. Informa: Aluguel Janeiro - R$ 1.200
4. Define vencimento: 17/01
5. Marca "Recorrente - Mensal"
6. Confirma
7. Sistema bloqueia R$ 1.200 imediatamente
8. Saldo disponível reduz de R$ 5.300 para R$ 4.100
9. Limite diário recalculado: R$ 136/dia
10. Sistema agenda execução para 17/01

**Pós-condições:**
- R$ 1.200 bloqueados
- Alarme criado para 14/01 (3 dias antes)
- Próximo aluguel agendado para 17/02

**Fluxo no Dia 17/01:**
1. Às 00:01, cron executa despesa
2. Debita R$ 1.200 do saldo total
3. Libera R$ 1.200 do saldo bloqueado
4. Notifica: "Aluguel pago - R$ 1.200"

---

### CU003 - Usuário Gasta em Restaurante

**Ator:** Usuário
**Pré-condições:** Saldo disponível > 0
**Fluxo Principal:**
1. Usuário acessa "Nova Despesa"
2. Seleciona categoria "Alimentação"
3. Informa: Almoço - R$ 50
4. Confirma
5. Sistema debita imediatamente R$ 50
6. Atualiza:
   - Total: R$ 6.950
   - Disponível: R$ 4.050
   - Gasto hoje: R$ 50
7. Exibe: "Você ainda pode gastar R$ 126 hoje"

**Fluxo Alternativo - Excesso:**
Se gasto acumulado do dia ultrapassar limite:
1. Sistema exibe alerta: "Você já gastou 120% do limite diário"
2. Pergunta: "Deseja continuar?"
3. Se sim, permite (não bloqueia)
4. Envia notificação de alerta

---

### CU004 - Consulta de Projeção Financeira

**Ator:** Usuário
**Pré-condições:** Conta com histórico mínimo de 30 dias
**Fluxo Principal:**
1. Usuário acessa Dashboard
2. Sistema exibe card "Projeção dos Próximos 30 Dias":
   - Receitas esperadas: R$ 3.000
   - Despesas fixas agendadas: R$ 2.400
   - Despesas variáveis previstas: R$ 1.500
   - Saldo projetado: R$ 4.900
3. Exibe gráfico de evolução diária
4. Destaca dias de vencimentos importantes
5. Mostra "zona de risco" se projeção ficar negativa

---

## 10. Considerações de Segurança

### 10.1 Autenticação e Autorização
- **JWT com refresh tokens:** Access token (15 min), Refresh token (7 dias)
- **Password hashing:** bcrypt com cost factor 12
- **2FA (Fase 2):** TOTP para operações críticas
- **Session management:** Logout revoga tokens

### 10.2 Proteção de Dados
- **Encryption at rest:** AES-256 para campos sensíveis (balance, amounts)
- **Encryption in transit:** TLS 1.3 obrigatório
- **Database encryption:** Transparent Data Encryption (TDE)
- **Backup encryption:** Encrypted backups com keys separadas

### 10.3 Proteção contra Ataques
- **Rate limiting:**
  - Login: 5 tentativas / 15 min
  - API geral: 100 req/min por usuário
  - Operações financeiras: 20 req/min
- **CSRF protection:** CSRF tokens em todas as mutations
- **SQL Injection:** Prepared statements, ORM com sanitização
- **XSS:** Content Security Policy, sanitização de inputs

### 10.4 Auditoria e Compliance
- **Audit logs:** Todas as transações financeiras
- **IP tracking:** Registro de IP em operações críticas
- **LGPD compliance:**
  - Consentimento explícito
  - Direito ao esquecimento
  - Exportação de dados
  - Notificação de vazamentos (72h)

### 10.5 Validações Críticas
```javascript
// Exemplo de validação em camadas
async function createTransaction(data) {
  // 1. Validação de schema
  const validated = transactionSchema.parse(data);

  // 2. Validação de negócio
  const account = await getAccount(validated.account_id);
  if (!account) throw new ForbiddenError();
  if (account.user_id !== currentUser.id) throw new ForbiddenError();

  // 3. Validação de integridade
  if (validated.amount <= 0) throw new ValidationError();
  if (validated.amount > MAX_TRANSACTION_AMOUNT) throw new ValidationError();

  // 4. Validação de saldo (atomic)
  await db.transaction(async (trx) => {
    const locked = await trx.raw('SELECT ... FOR UPDATE');
    if (locked.available_balance < validated.amount) {
      throw new InsufficientBalanceError();
    }
    // ... prosseguir
  });
}
```

---

## 11. Roadmap de Implementação

### Fase 1 - MVP (2 meses)
**Objetivo:** Funcionalidades core operacionais

- [ ] Setup de infraestrutura (DB, Redis, API)
- [ ] Autenticação e gestão de usuários
- [ ] CRUD de contas
- [ ] Sistema de transações (receitas, despesas fixas e variáveis)
- [ ] Motor de regras (divisão 30/70, bloqueio)
- [ ] Cálculo básico de sugestão de limite
- [ ] Dashboard mínimo viável
- [ ] Testes unitários e integração (>70% coverage)

**Entregáveis:**
- API REST funcional
- Web app com fluxos principais
- Documentação técnica

---

### Fase 2 - Inteligência e Automação (1,5 meses)
**Objetivo:** Melhorar sugestões e automação

- [ ] Algoritmo avançado de sugestão (ML básico)
- [ ] Sistema de notificações push
- [ ] Recorrência automática de transações
- [ ] Relatórios e exportação (CSV, PDF)
- [ ] Categorização inteligente de despesas
- [ ] Gráficos e visualizações avançadas

---

### Fase 3 - Mobile e Expansão (2 meses)
**Objetivo:** App mobile e integrações

- [ ] App React Native (iOS + Android)
- [ ] Sincronização offline-first
- [ ] OCR para notas fiscais
- [ ] Integração com Open Banking (Fase inicial)
- [ ] Multi-contas e transferências
- [ ] Sistema de metas financeiras

---

### Fase 4 - Enterprise (Futuro)
**Objetivo:** Escalabilidade e recursos avançados

- [ ] Multi-tenant architecture
- [ ] Planos premium/freemium
- [ ] AI avançada para previsões
- [ ] Integração com bancos e cartões
- [ ] Consultoria financeira automatizada
- [ ] Marketplace de produtos financeiros

---

## 12. Métricas de Sucesso

### Métricas Técnicas
- **Performance:** P95 < 200ms, P99 < 500ms
- **Disponibilidade:** SLA 99.5%
- **Cobertura de Testes:** > 80%
- **Bug Rate:** < 1% de transações com erro

### Métricas de Produto
- **Adoção:** 70% dos usuários registram >10 transações/mês
- **Retenção:** 60% de usuários ativos mês a mês
- **Engajamento:** Usuários acessam app 4x/semana em média
- **Satisfação:** NPS > 50

### Métricas de Negócio
- **Economia gerada:** Usuários economizam 20% em média
- **Reserva de emergência:** 80% dos usuários atingem meta de 3 meses
- **Controle de gastos:** 70% dos usuários respeitam limite sugerido

---

## 13. Anexos

### 13.1 Exemplo de Payload Completo

**Criação de Receita Recorrente:**
```json
POST /api/v1/transactions/income

{
  "account_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "category_id": "cat-salary-001",
  "amount": 5000.00,
  "description": "Salário Janeiro 2026",
  "due_date": "2026-01-05",
  "is_recurring": true,
  "recurrence_pattern": "monthly",
  "tags": ["salário", "renda-principal"],
  "metadata": {
    "company": "Empresa XYZ",
    "payment_method": "TED"
  }
}

Response 201:
{
  "success": true,
  "transaction": {
    "id": "t-001",
    "account_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
    "type": "income",
    "amount": 5000.00,
    "status": "executed",
    "executed_date": "2026-01-05T10:30:00Z",
    "created_at": "2026-01-05T10:30:00Z"
  },
  "breakdown": {
    "total_received": 5000.00,
    "emergency_reserve": 1500.00,
    "available": 3500.00
  },
  "account_balances": {
    "total_balance": 12000.00,
    "available_balance": 8500.00,
    "locked_balance": 1200.00,
    "emergency_reserve": 2300.00
  },
  "next_suggestion": {
    "daily_limit": 283.33,
    "monthly_projection": 8500.00,
    "valid_until": "2026-02-05"
  },
  "next_recurrence": {
    "id": "t-002",
    "due_date": "2026-02-05",
    "status": "scheduled"
  }
}
```

### 13.2 Glossário

| Termo | Definição |
|-------|-----------|
| **Saldo Total** | Soma de todos os recursos: disponível + bloqueado + reserva |
| **Saldo Disponível** | Valor que pode ser gasto imediatamente |
| **Saldo Bloqueado** | Valor reservado para despesas fixas agendadas |
| **Reserva de Emergência** | Valor acumulado automaticamente (30% das receitas) |
| **Despesa Fixa** | Despesa com data futura, bloqueada preventivamente |
| **Despesa Variável** | Despesa com débito imediato |
| **Limite Diário** | Sugestão calculada de quanto gastar por dia |
| **Recorrência** | Transação que se repete automaticamente |

---

## 14. Conclusão

Esta especificação define uma aplicação de gerenciamento financeiro pessoal com foco em automação inteligente e controle proativo. O sistema implementa regras de negócio claras para construção de reserva de emergência, gestão de despesas fixas com bloqueio preventivo e sugestões inteligentes de gastos.

A arquitetura proposta é escalável, segura e permite evolução gradual através de fases bem definidas. O MVP entrega valor imediato ao usuário, enquanto fases futuras trazem inteligência artificial, integrações bancárias e recursos avançados.

**Próximos Passos:**
1. Review e aprovação da especificação
2. Setup do ambiente de desenvolvimento
3. Início da Fase 1 (MVP)
4. Sprints de 2 semanas com entregas incrementais

---

**Documento vivo - atualizar conforme evolução do projeto**
