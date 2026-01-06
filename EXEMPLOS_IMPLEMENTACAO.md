# Exemplos de Implementação - BFIN

> Exemplos práticos de código, queries SQL e configurações para o sistema BFIN

---

## 1. Scripts SQL Úteis

### 1.1 Consultas de Saldo e Integridade

```sql
-- Verificar integridade de saldos de todas as contas
SELECT
  id,
  account_name,
  total_balance,
  available_balance + locked_balance + emergency_reserve AS calculated_total,
  CASE
    WHEN total_balance = available_balance + locked_balance + emergency_reserve
    THEN 'OK'
    ELSE 'ERRO'
  END AS integrity_check
FROM accounts
WHERE total_balance != available_balance + locked_balance + emergency_reserve;

-- Se retornar linhas, há inconsistência!
```

```sql
-- Obter resumo financeiro completo de uma conta
SELECT
  a.account_name,
  a.total_balance,
  a.available_balance,
  a.locked_balance,
  a.emergency_reserve,
  COUNT(DISTINCT CASE WHEN t.type = 'income' THEN t.id END) AS total_incomes,
  COUNT(DISTINCT CASE WHEN t.type = 'fixed_expense' AND t.status = 'locked' THEN t.id END) AS pending_fixed,
  COUNT(DISTINCT CASE WHEN t.type = 'variable_expense' THEN t.id END) AS variable_count,
  COALESCE(SUM(CASE WHEN t.type = 'variable_expense' AND t.executed_date >= CURRENT_DATE THEN t.amount END), 0) AS spent_today
FROM accounts a
LEFT JOIN transactions t ON t.account_id = a.id
WHERE a.id = 'uuid-da-conta'
GROUP BY a.id, a.account_name, a.total_balance, a.available_balance, a.locked_balance, a.emergency_reserve;
```

---

### 1.2 Análises de Gastos

```sql
-- Gastos por categoria no último mês
SELECT
  c.name AS category,
  c.type,
  COUNT(t.id) AS transaction_count,
  SUM(t.amount) AS total_amount,
  AVG(t.amount) AS avg_amount,
  ROUND((SUM(t.amount) / (SELECT SUM(amount) FROM transactions WHERE type = 'variable_expense' AND executed_date >= DATE_TRUNC('month', CURRENT_DATE))) * 100, 2) AS percentage
FROM transactions t
JOIN categories c ON c.id = t.category_id
WHERE t.type = 'variable_expense'
  AND t.executed_date >= DATE_TRUNC('month', CURRENT_DATE)
  AND t.account_id = 'uuid-da-conta'
GROUP BY c.id, c.name, c.type
ORDER BY total_amount DESC;
```

```sql
-- Evolução mensal de receitas vs despesas (últimos 6 meses)
SELECT
  TO_CHAR(DATE_TRUNC('month', executed_date), 'YYYY-MM') AS month,
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS total_income,
  SUM(CASE WHEN type IN ('fixed_expense', 'variable_expense') THEN amount ELSE 0 END) AS total_expenses,
  SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS net_balance
FROM transactions
WHERE account_id = 'uuid-da-conta'
  AND executed_date >= CURRENT_DATE - INTERVAL '6 months'
  AND status = 'executed'
GROUP BY DATE_TRUNC('month', executed_date)
ORDER BY month DESC;
```

```sql
-- Top 10 maiores gastos do mês
SELECT
  t.description,
  c.name AS category,
  t.amount,
  t.executed_date,
  t.type
FROM transactions t
LEFT JOIN categories c ON c.id = t.category_id
WHERE t.account_id = 'uuid-da-conta'
  AND t.type IN ('fixed_expense', 'variable_expense')
  AND t.executed_date >= DATE_TRUNC('month', CURRENT_DATE)
  AND t.status = 'executed'
ORDER BY t.amount DESC
LIMIT 10;
```

---

### 1.3 Despesas Agendadas

```sql
-- Listar todas as despesas fixas agendadas (próximos 30 dias)
SELECT
  t.description,
  t.amount,
  t.due_date,
  t.status,
  t.is_recurring,
  c.name AS category,
  DATE_PART('day', t.due_date - CURRENT_DATE) AS days_until_due
FROM transactions t
LEFT JOIN categories c ON c.id = t.category_id
WHERE t.account_id = 'uuid-da-conta'
  AND t.type = 'fixed_expense'
  AND t.status = 'locked'
  AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
ORDER BY t.due_date ASC;
```

```sql
-- Total bloqueado por mês futuro
SELECT
  TO_CHAR(DATE_TRUNC('month', due_date), 'YYYY-MM') AS month,
  SUM(amount) AS total_locked
FROM transactions
WHERE account_id = 'uuid-da-conta'
  AND type = 'fixed_expense'
  AND status = 'locked'
  AND due_date >= CURRENT_DATE
GROUP BY DATE_TRUNC('month', due_date)
ORDER BY month;
```

---

### 1.4 Cron Jobs e Automações

```sql
-- Executar despesas fixas vencidas (rodar todo dia às 00:01)
WITH executed_expenses AS (
  UPDATE transactions
  SET
    status = 'executed',
    executed_date = CURRENT_DATE,
    updated_at = CURRENT_TIMESTAMP
  WHERE status = 'locked'
    AND type = 'fixed_expense'
    AND due_date = CURRENT_DATE
  RETURNING id, account_id, amount, description, is_recurring, recurrence_pattern
)
UPDATE accounts a
SET
  total_balance = a.total_balance - e.amount,
  locked_balance = a.locked_balance - e.amount,
  updated_at = CURRENT_TIMESTAMP
FROM executed_expenses e
WHERE a.id = e.account_id;

-- Retorna as despesas executadas para processamento de recorrência
SELECT * FROM executed_expenses;
```

```sql
-- Criar próximas instâncias de despesas recorrentes
-- (executar após o cron acima)
INSERT INTO transactions (
  account_id,
  category_id,
  type,
  amount,
  description,
  due_date,
  status,
  is_recurring,
  recurrence_pattern,
  parent_transaction_id
)
SELECT
  account_id,
  category_id,
  type,
  amount,
  description,
  CASE
    WHEN recurrence_pattern = 'monthly' THEN due_date + INTERVAL '1 month'
    WHEN recurrence_pattern = 'weekly' THEN due_date + INTERVAL '1 week'
    WHEN recurrence_pattern = 'yearly' THEN due_date + INTERVAL '1 year'
  END AS next_due_date,
  'pending' AS status,
  is_recurring,
  recurrence_pattern,
  id AS parent_id
FROM transactions
WHERE status = 'executed'
  AND is_recurring = true
  AND executed_date = CURRENT_DATE
  AND type = 'fixed_expense'
  AND (recurrence_end_date IS NULL OR due_date + INTERVAL '1 month' <= recurrence_end_date);
```

---

## 2. Implementação Backend (Node.js)

### 2.1 Service: Transaction Service

```typescript
// src/services/TransactionService.ts

import { PrismaClient } from '@prisma/client';
import { InsufficientBalanceError, ValidationError } from '../errors';
import { FinancialRulesEngine } from './FinancialRulesEngine';
import { SuggestionEngine } from './SuggestionEngine';
import { NotificationService } from './NotificationService';

const prisma = new PrismaClient();

export class TransactionService {
  private rulesEngine: FinancialRulesEngine;
  private suggestionEngine: SuggestionEngine;
  private notificationService: NotificationService;

  constructor() {
    this.rulesEngine = new FinancialRulesEngine();
    this.suggestionEngine = new SuggestionEngine();
    this.notificationService = new NotificationService();
  }

  /**
   * Processa uma receita aplicando regras automáticas
   */
  async processIncome(data: {
    accountId: string;
    amount: number;
    description: string;
    categoryId: string;
    dueDate: Date;
    isRecurring?: boolean;
    recurrencePattern?: string;
  }) {
    // Validações
    if (data.amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar conta
      const account = await tx.accounts.findUnique({
        where: { id: data.accountId },
      });

      if (!account) {
        throw new ValidationError('Account not found');
      }

      // 2. Buscar regras ativas
      const rules = await this.rulesEngine.getActiveRules(data.accountId);
      const emergencyRule = rules.find(r => r.rule_type === 'emergency_reserve');

      const reservePercentage = emergencyRule?.percentage || 30;
      const reserveAmount = data.amount * (reservePercentage / 100);
      const availableAmount = data.amount - reserveAmount;

      // 3. Atualizar saldos
      const updatedAccount = await tx.accounts.update({
        where: { id: data.accountId },
        data: {
          total_balance: { increment: data.amount },
          emergency_reserve: { increment: reserveAmount },
          available_balance: { increment: availableAmount },
          updated_at: new Date(),
        },
      });

      // 4. Criar transação
      const transaction = await tx.transactions.create({
        data: {
          account_id: data.accountId,
          category_id: data.categoryId,
          type: 'income',
          amount: data.amount,
          description: data.description,
          due_date: data.dueDate,
          executed_date: new Date(),
          status: 'executed',
          is_recurring: data.isRecurring || false,
          recurrence_pattern: data.recurrencePattern,
        },
      });

      // 5. Criar snapshot de histórico
      await tx.balance_history.create({
        data: {
          account_id: data.accountId,
          transaction_id: transaction.id,
          total_balance: updatedAccount.total_balance,
          available_balance: updatedAccount.available_balance,
          locked_balance: updatedAccount.locked_balance,
          emergency_reserve: updatedAccount.emergency_reserve,
          change_reason: 'income_received',
        },
      });

      // 6. Recalcular sugestão
      const suggestion = await this.suggestionEngine.calculateDailyLimit(data.accountId);

      // 7. Criar notificação
      await this.notificationService.create({
        userId: account.user_id,
        type: 'income_received',
        title: 'Receita processada',
        message: `R$ ${data.amount.toFixed(2)} recebido. Reserva: R$ ${reserveAmount.toFixed(2)}, Disponível: R$ ${availableAmount.toFixed(2)}`,
        relatedTransactionId: transaction.id,
      });

      return {
        transaction,
        breakdown: {
          total_received: data.amount,
          emergency_reserve: reserveAmount,
          available: availableAmount,
        },
        account_balances: {
          total_balance: updatedAccount.total_balance,
          available_balance: updatedAccount.available_balance,
          locked_balance: updatedAccount.locked_balance,
          emergency_reserve: updatedAccount.emergency_reserve,
        },
        next_suggestion: suggestion,
      };
    });
  }

  /**
   * Cria despesa fixa com bloqueio preventivo
   */
  async createFixedExpense(data: {
    accountId: string;
    amount: number;
    description: string;
    categoryId: string;
    dueDate: Date;
    isRecurring?: boolean;
    recurrencePattern?: string;
  }) {
    if (data.amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    if (data.dueDate < new Date()) {
      throw new ValidationError('Due date cannot be in the past');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar e validar conta
      const account = await tx.accounts.findUnique({
        where: { id: data.accountId },
      });

      if (!account) {
        throw new ValidationError('Account not found');
      }

      if (account.available_balance < data.amount) {
        throw new InsufficientBalanceError(
          `Insufficient balance. Available: R$ ${account.available_balance}, Required: R$ ${data.amount}`
        );
      }

      // 2. Bloquear saldo
      const updatedAccount = await tx.accounts.update({
        where: { id: data.accountId },
        data: {
          available_balance: { decrement: data.amount },
          locked_balance: { increment: data.amount },
          updated_at: new Date(),
        },
      });

      // 3. Criar transação com status locked
      const transaction = await tx.transactions.create({
        data: {
          account_id: data.accountId,
          category_id: data.categoryId,
          type: 'fixed_expense',
          amount: data.amount,
          description: data.description,
          due_date: data.dueDate,
          status: 'locked',
          is_recurring: data.isRecurring || false,
          recurrence_pattern: data.recurrencePattern,
        },
      });

      // 4. Criar snapshot
      await tx.balance_history.create({
        data: {
          account_id: data.accountId,
          transaction_id: transaction.id,
          total_balance: updatedAccount.total_balance,
          available_balance: updatedAccount.available_balance,
          locked_balance: updatedAccount.locked_balance,
          emergency_reserve: updatedAccount.emergency_reserve,
          change_reason: 'expense_locked',
        },
      });

      // 5. Recalcular sugestão
      const suggestion = await this.suggestionEngine.calculateDailyLimit(data.accountId);

      // 6. Notificar
      await this.notificationService.create({
        userId: account.user_id,
        type: 'expense_scheduled',
        title: 'Despesa agendada',
        message: `${data.description}: R$ ${data.amount.toFixed(2)} agendado para ${data.dueDate.toLocaleDateString()}`,
        relatedTransactionId: transaction.id,
      });

      return {
        transaction,
        account_balances: {
          total_balance: updatedAccount.total_balance,
          available_balance: updatedAccount.available_balance,
          locked_balance: updatedAccount.locked_balance,
        },
        next_suggestion: suggestion,
      };
    });
  }

  /**
   * Cria despesa variável com débito imediato
   */
  async createVariableExpense(data: {
    accountId: string;
    amount: number;
    description: string;
    categoryId: string;
  }) {
    if (data.amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar conta
      const account = await tx.accounts.findUnique({
        where: { id: data.accountId },
      });

      if (!account) {
        throw new ValidationError('Account not found');
      }

      if (account.available_balance < data.amount) {
        throw new InsufficientBalanceError(
          `Insufficient balance. Available: R$ ${account.available_balance}, Required: R$ ${data.amount}`
        );
      }

      // 2. Débito imediato
      const updatedAccount = await tx.accounts.update({
        where: { id: data.accountId },
        data: {
          total_balance: { decrement: data.amount },
          available_balance: { decrement: data.amount },
          updated_at: new Date(),
        },
      });

      // 3. Criar transação executada
      const transaction = await tx.transactions.create({
        data: {
          account_id: data.accountId,
          category_id: data.categoryId,
          type: 'variable_expense',
          amount: data.amount,
          description: data.description,
          due_date: new Date(),
          executed_date: new Date(),
          status: 'executed',
        },
      });

      // 4. Snapshot
      await tx.balance_history.create({
        data: {
          account_id: data.accountId,
          transaction_id: transaction.id,
          total_balance: updatedAccount.total_balance,
          available_balance: updatedAccount.available_balance,
          locked_balance: updatedAccount.locked_balance,
          emergency_reserve: updatedAccount.emergency_reserve,
          change_reason: 'expense_paid',
        },
      });

      // 5. Recalcular sugestão
      const suggestion = await this.suggestionEngine.calculateDailyLimit(data.accountId);

      // 6. Verificar se excedeu limite do dia
      const todayExpenses = await this.getTodayExpenses(data.accountId);
      const dailySpent = todayExpenses.reduce((sum, t) => sum + Number(t.amount), 0);

      let alert = null;
      if (dailySpent > suggestion.daily_limit) {
        const percentage = Math.round((dailySpent / suggestion.daily_limit) * 100);
        alert = {
          type: 'limit_exceeded',
          message: `Você gastou ${percentage}% do limite diário sugerido`,
        };

        await this.notificationService.create({
          userId: account.user_id,
          type: 'limit_exceeded',
          title: 'Limite diário excedido',
          message: `Você gastou R$ ${dailySpent.toFixed(2)} hoje. Limite sugerido: R$ ${suggestion.daily_limit.toFixed(2)}`,
        });
      }

      return {
        transaction,
        account_balances: {
          total_balance: updatedAccount.total_balance,
          available_balance: updatedAccount.available_balance,
        },
        daily_spent: dailySpent,
        daily_limit: suggestion.daily_limit,
        alert,
      };
    });
  }

  /**
   * Busca gastos do dia atual
   */
  private async getTodayExpenses(accountId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await prisma.transactions.findMany({
      where: {
        account_id: accountId,
        type: 'variable_expense',
        executed_date: {
          gte: today,
        },
        status: 'executed',
      },
    });
  }
}
```

---

### 2.2 Service: Suggestion Engine

```typescript
// src/services/SuggestionEngine.ts

import { PrismaClient } from '@prisma/client';
import { differenceInDays, addDays } from 'date-fns';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL);

export class SuggestionEngine {
  /**
   * Calcula limite diário sugerido
   */
  async calculateDailyLimit(accountId: string) {
    // 1. Buscar conta
    const account = await prisma.accounts.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    // 2. Buscar próxima receita
    const nextIncome = await prisma.transactions.findFirst({
      where: {
        account_id: accountId,
        type: 'income',
        due_date: { gte: new Date() },
        status: { in: ['pending', 'locked'] },
      },
      orderBy: { due_date: 'asc' },
    });

    // Calcular dias até próxima receita (padrão: 30 dias)
    const daysUntilIncome = nextIncome
      ? differenceInDays(nextIncome.due_date, new Date())
      : 30;

    // Garantir no mínimo 1 dia
    const safeDays = Math.max(daysUntilIncome, 1);

    // 3. Buscar média de gastos dos últimos 90 dias
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const historicalExpenses = await prisma.transactions.aggregate({
      where: {
        account_id: accountId,
        type: 'variable_expense',
        executed_date: { gte: ninetyDaysAgo },
        status: 'executed',
      },
      _sum: { amount: true },
      _count: true,
    });

    const totalHistorical = Number(historicalExpenses._sum.amount || 0);
    const avgDailyExpense = totalHistorical / 90;

    // 4. Aplicar fórmula
    const baseLimit = Number(account.available_balance) / safeDays;
    const safetyFactor = 0.9; // 10% de margem de segurança
    const adjustedLimit = baseLimit * safetyFactor;

    // Não exceder 120% da média histórica
    const historicalCap = avgDailyExpense * 1.2;
    const finalLimit = Math.min(adjustedLimit, historicalCap);

    // 5. Projeção mensal
    const monthlyProjection = finalLimit * 30;

    // 6. Salvar sugestão
    const suggestion = await prisma.spending_suggestions.create({
      data: {
        account_id: accountId,
        suggestion_date: new Date(),
        valid_until: nextIncome?.due_date || addDays(new Date(), 30),
        daily_limit: finalLimit,
        monthly_projection: monthlyProjection,
        available_balance_snapshot: account.available_balance,
        locked_balance_snapshot: account.locked_balance,
        days_until_next_income: safeDays,
        average_daily_expense: avgDailyExpense,
        calculation_metadata: {
          base_limit: baseLimit,
          safety_factor: safetyFactor,
          historical_cap: historicalCap,
          algorithm_version: '1.0',
        },
      },
    });

    // 7. Cachear no Redis (24 horas)
    await redis.setex(
      `suggestion:${accountId}`,
      86400,
      JSON.stringify(suggestion)
    );

    return suggestion;
  }

  /**
   * Busca sugestão atual (com cache)
   */
  async getCurrentSuggestion(accountId: string) {
    // Tentar buscar do cache
    const cached = await redis.get(`suggestion:${accountId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Buscar mais recente do DB
    const suggestion = await prisma.spending_suggestions.findFirst({
      where: { account_id: accountId },
      orderBy: { created_at: 'desc' },
    });

    if (!suggestion) {
      // Se não existe, calcular
      return await this.calculateDailyLimit(accountId);
    }

    // Cachear
    await redis.setex(
      `suggestion:${accountId}`,
      86400,
      JSON.stringify(suggestion)
    );

    return suggestion;
  }
}
```

---

### 2.3 Cron Job: Executar Despesas Agendadas

```typescript
// src/jobs/ExecuteScheduledExpenses.ts

import { PrismaClient } from '@prisma/client';
import { NotificationService } from '../services/NotificationService';
import { SuggestionEngine } from '../services/SuggestionEngine';

const prisma = new PrismaClient();

export async function executeScheduledExpenses() {
  console.log('[Cron] Executing scheduled expenses for today...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // 1. Buscar despesas fixas vencidas hoje
    const dueExpenses = await prisma.transactions.findMany({
      where: {
        type: 'fixed_expense',
        status: 'locked',
        due_date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000), // próximas 24h
        },
      },
      include: {
        account: true,
      },
    });

    console.log(`[Cron] Found ${dueExpenses.length} expenses to execute`);

    // 2. Processar cada despesa
    for (const expense of dueExpenses) {
      await prisma.$transaction(async (tx) => {
        // Atualizar conta (debitar saldo total, liberar bloqueado)
        await tx.accounts.update({
          where: { id: expense.account_id },
          data: {
            total_balance: { decrement: expense.amount },
            locked_balance: { decrement: expense.amount },
            updated_at: new Date(),
          },
        });

        // Atualizar transação
        await tx.transactions.update({
          where: { id: expense.id },
          data: {
            status: 'executed',
            executed_date: new Date(),
            updated_at: new Date(),
          },
        });

        // Criar snapshot
        const updatedAccount = await tx.accounts.findUnique({
          where: { id: expense.account_id },
        });

        await tx.balance_history.create({
          data: {
            account_id: expense.account_id,
            transaction_id: expense.id,
            total_balance: updatedAccount!.total_balance,
            available_balance: updatedAccount!.available_balance,
            locked_balance: updatedAccount!.locked_balance,
            emergency_reserve: updatedAccount!.emergency_reserve,
            change_reason: 'expense_executed',
          },
        });

        // Se recorrente, criar próxima instância
        if (expense.is_recurring && expense.recurrence_pattern) {
          let nextDueDate = new Date(expense.due_date);

          switch (expense.recurrence_pattern) {
            case 'monthly':
              nextDueDate.setMonth(nextDueDate.getMonth() + 1);
              break;
            case 'weekly':
              nextDueDate.setDate(nextDueDate.getDate() + 7);
              break;
            case 'yearly':
              nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
              break;
          }

          await tx.transactions.create({
            data: {
              account_id: expense.account_id,
              category_id: expense.category_id,
              type: 'fixed_expense',
              amount: expense.amount,
              description: expense.description,
              due_date: nextDueDate,
              status: 'pending',
              is_recurring: true,
              recurrence_pattern: expense.recurrence_pattern,
              parent_transaction_id: expense.id,
            },
          });
        }

        console.log(`[Cron] Executed expense: ${expense.description} - R$ ${expense.amount}`);
      });

      // Recalcular sugestão
      const suggestionEngine = new SuggestionEngine();
      await suggestionEngine.calculateDailyLimit(expense.account_id);

      // Notificar usuário
      const notificationService = new NotificationService();
      await notificationService.create({
        userId: expense.account.user_id,
        type: 'expense_executed',
        title: 'Despesa paga',
        message: `${expense.description}: R$ ${expense.amount.toFixed(2)} debitado`,
        relatedTransactionId: expense.id,
      });
    }

    console.log('[Cron] Finished executing scheduled expenses');
  } catch (error) {
    console.error('[Cron] Error executing scheduled expenses:', error);
    throw error;
  }
}

// Configurar cron para rodar todo dia às 00:01
import cron from 'node-cron';

cron.schedule('1 0 * * *', () => {
  executeScheduledExpenses().catch(console.error);
});
```

---

## 3. Testes

### 3.1 Teste de Integração: Fluxo Completo

```typescript
// tests/integration/transaction-flow.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { TransactionService } from '../../src/services/TransactionService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const transactionService = new TransactionService();

describe('Transaction Flow Integration Test', () => {
  let testAccountId: string;
  let testUserId: string;
  let categoryIncomeId: string;
  let categoryExpenseId: string;

  beforeEach(async () => {
    // Setup: criar usuário e conta de teste
    const user = await prisma.users.create({
      data: {
        email: 'test@bfin.com',
        password_hash: 'hash',
        full_name: 'Test User',
      },
    });
    testUserId = user.id;

    const account = await prisma.accounts.create({
      data: {
        user_id: testUserId,
        account_name: 'Test Account',
        total_balance: 0,
        available_balance: 0,
        locked_balance: 0,
        emergency_reserve: 0,
      },
    });
    testAccountId = account.id;

    const catIncome = await prisma.categories.create({
      data: { name: 'Salário', type: 'income' },
    });
    categoryIncomeId = catIncome.id;

    const catExpense = await prisma.categories.create({
      data: { name: 'Moradia', type: 'expense' },
    });
    categoryExpenseId = catExpense.id;
  });

  it('should process complete monthly flow correctly', async () => {
    // 1. Receber salário de R$ 5.000
    const incomeResult = await transactionService.processIncome({
      accountId: testAccountId,
      amount: 5000,
      description: 'Salário Janeiro',
      categoryId: categoryIncomeId,
      dueDate: new Date(),
    });

    // Verificar divisão 30/70
    expect(incomeResult.breakdown.emergency_reserve).toBe(1500); // 30%
    expect(incomeResult.breakdown.available).toBe(3500); // 70%
    expect(incomeResult.account_balances.total_balance).toBe(5000);
    expect(incomeResult.account_balances.emergency_reserve).toBe(1500);
    expect(incomeResult.account_balances.available_balance).toBe(3500);

    // 2. Agendar aluguel de R$ 1.200 para daqui 10 dias
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const fixedExpenseResult = await transactionService.createFixedExpense({
      accountId: testAccountId,
      amount: 1200,
      description: 'Aluguel Janeiro',
      categoryId: categoryExpenseId,
      dueDate: futureDate,
    });

    // Verificar bloqueio
    expect(fixedExpenseResult.account_balances.available_balance).toBe(2300); // 3500 - 1200
    expect(fixedExpenseResult.account_balances.locked_balance).toBe(1200);
    expect(fixedExpenseResult.account_balances.total_balance).toBe(5000); // total não muda

    // 3. Gastar R$ 50 em alimentação
    const variableExpenseResult = await transactionService.createVariableExpense({
      accountId: testAccountId,
      amount: 50,
      description: 'Almoço',
      categoryId: categoryExpenseId,
    });

    // Verificar débito imediato
    expect(variableExpenseResult.account_balances.total_balance).toBe(4950); // 5000 - 50
    expect(variableExpenseResult.account_balances.available_balance).toBe(2250); // 2300 - 50

    // 4. Verificar integridade final
    const finalAccount = await prisma.accounts.findUnique({
      where: { id: testAccountId },
    });

    const sum =
      Number(finalAccount!.available_balance) +
      Number(finalAccount!.locked_balance) +
      Number(finalAccount!.emergency_reserve);

    expect(sum).toBe(Number(finalAccount!.total_balance));
    expect(finalAccount!.total_balance).toBe(4950);
  });

  it('should reject expense if insufficient balance', async () => {
    // Criar despesa maior que saldo disponível
    await expect(
      transactionService.createVariableExpense({
        accountId: testAccountId,
        amount: 9999,
        description: 'Despesa impossível',
        categoryId: categoryExpenseId,
      })
    ).rejects.toThrow('Insufficient balance');
  });
});
```

---

## 4. Configuração de Ambiente

### 4.1 .env.example

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/bfin_dev"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-super-secret-key-change-in-production"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# App
PORT=3000
NODE_ENV="development"

# Email (para notificações)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# S3 (para comprovantes)
AWS_ACCESS_KEY_ID="your-key"
AWS_SECRET_ACCESS_KEY="your-secret"
AWS_BUCKET_NAME="bfin-attachments"
AWS_REGION="us-east-1"

# Sentry (monitoramento)
SENTRY_DSN="https://your-sentry-dsn"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## 5. Docker Compose para Desenvolvimento

```yaml
# docker-compose.yml

version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: bfin_postgres
    environment:
      POSTGRES_USER: bfin_user
      POSTGRES_PASSWORD: bfin_pass
      POSTGRES_DB: bfin_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bfin_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: bfin_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  adminer:
    image: adminer
    container_name: bfin_adminer
    ports:
      - "8080:8080"
    depends_on:
      - postgres

volumes:
  postgres_data:
  redis_data:
```

**Comandos:**
```bash
# Subir ambiente
docker-compose up -d

# Parar ambiente
docker-compose down

# Ver logs
docker-compose logs -f

# Acessar PostgreSQL via Adminer
# http://localhost:8080
# System: PostgreSQL
# Server: postgres
# Username: bfin_user
# Password: bfin_pass
# Database: bfin_dev
```

---

## 6. Scripts Package.json

```json
{
  "name": "bfin-api",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:seed": "tsx prisma/seed.ts",
    "db:reset": "prisma migrate reset",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write \"src/**/*.ts\"",
    "cron:execute-expenses": "tsx src/jobs/ExecuteScheduledExpenses.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "express": "^4.18.2",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.22.4",
    "date-fns": "^2.30.0",
    "ioredis": "^5.3.2",
    "node-cron": "^3.0.2",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.5.0",
    "@types/express": "^4.17.17",
    "typescript": "^5.1.6",
    "tsx": "^3.12.7",
    "prisma": "^5.0.0",
    "vitest": "^0.34.1",
    "@vitest/ui": "^0.34.1"
  }
}
```

---

## Conclusão

Estes exemplos fornecem uma base sólida para implementação do sistema BFIN. Adapte conforme necessário e mantenha sempre os princípios de integridade de dados, validações rigorosas e auditoria completa.
