import { PrismaClient } from '@prisma/client';
import { ValidationError, InsufficientBalanceError, NotFoundError, ForbiddenError } from '../middlewares/errorHandler';
import { SuggestionEngine } from './SuggestionEngine';

const prisma = new PrismaClient();

interface CreateIncomeDTO {
  accountId: string;
  amount: number;
  description: string;
  categoryId: string;
  dueDate?: Date;
  isRecurring?: boolean;
  recurrencePattern?: string;
}

interface CreateFixedExpenseDTO {
  accountId: string;
  amount: number;
  description: string;
  categoryId: string;
  dueDate: Date;
  isRecurring?: boolean;
  recurrencePattern?: string;
}

interface CreateVariableExpenseDTO {
  accountId: string;
  amount: number;
  description: string;
  categoryId: string;
}

export class TransactionService {
  /**
   * Processa uma receita aplicando regras automáticas (30/70)
   */
  async processIncome(userId: string, data: CreateIncomeDTO) {
    // Validações
    if (data.amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar conta e verificar propriedade
      const account = await tx.account.findUnique({
        where: { id: data.accountId },
      });

      if (!account) {
        throw new NotFoundError('Account not found');
      }

      if (account.user_id !== userId) {
        throw new ForbiddenError('Access denied to this account');
      }

      // 2. Buscar regras ativas
      const rules = await tx.financialRule.findMany({
        where: {
          account_id: data.accountId,
          is_active: true,
        },
        orderBy: { priority: 'asc' },
      });

      const emergencyRule = rules.find(r => r.rule_type === 'emergency_reserve');
      const reservePercentage = emergencyRule?.percentage ? Number(emergencyRule.percentage) : 30;

      // 3. Calcular divisão 30/70
      const reserveAmount = data.amount * (reservePercentage / 100);
      const availableAmount = data.amount - reserveAmount;

      // 4. Atualizar saldos da conta
      const updatedAccount = await tx.account.update({
        where: { id: data.accountId },
        data: {
          total_balance: { increment: data.amount },
          emergency_reserve: { increment: reserveAmount },
          available_balance: { increment: availableAmount },
          updated_at: new Date(),
        },
      });

      // 5. Criar transação
      const transaction = await tx.transaction.create({
        data: {
          account_id: data.accountId,
          category_id: data.categoryId,
          type: 'income',
          amount: data.amount,
          description: data.description,
          due_date: data.dueDate || new Date(),
          executed_date: new Date(),
          status: 'executed',
          is_recurring: data.isRecurring || false,
          recurrence_pattern: data.recurrencePattern,
        },
      });

      // 6. Criar snapshot de histórico
      await tx.balanceHistory.create({
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

      // 7. Invalidar cache de sugestão
      await SuggestionEngine.invalidateCache(data.accountId);

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
      };
    });
  }

  /**
   * Cria despesa fixa com bloqueio preventivo
   */
  async createFixedExpense(userId: string, data: CreateFixedExpenseDTO) {
    // Validações
    if (data.amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    // Validate due date is not in the past (allow today)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    if (data.dueDate < today) {
      throw new ValidationError('Due date cannot be in the past');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar e validar conta
      const account = await tx.account.findUnique({
        where: { id: data.accountId },
      });

      if (!account) {
        throw new NotFoundError('Account not found');
      }

      if (account.user_id !== userId) {
        throw new ForbiddenError('Access denied to this account');
      }

      // 2. Verificar saldo disponível
      if (Number(account.available_balance) < data.amount) {
        throw new InsufficientBalanceError(
          `Insufficient balance. Available: R$ ${account.available_balance}, Required: R$ ${data.amount}`
        );
      }

      // 3. Bloquear saldo preventivamente
      const updatedAccount = await tx.account.update({
        where: { id: data.accountId },
        data: {
          available_balance: { decrement: data.amount },
          locked_balance: { increment: data.amount },
          updated_at: new Date(),
        },
      });

      // 4. Criar transação com status 'locked'
      const transaction = await tx.transaction.create({
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

      // 5. Criar snapshot
      await tx.balanceHistory.create({
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

      // 6. Invalidar cache de sugestão
      await SuggestionEngine.invalidateCache(data.accountId);

      return {
        transaction,
        account_balances: {
          total_balance: updatedAccount.total_balance,
          available_balance: updatedAccount.available_balance,
          locked_balance: updatedAccount.locked_balance,
        },
      };
    });
  }

  /**
   * Cria despesa variável com débito imediato
   */
  async createVariableExpense(userId: string, data: CreateVariableExpenseDTO) {
    // Validações
    if (data.amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar conta
      const account = await tx.account.findUnique({
        where: { id: data.accountId },
      });

      if (!account) {
        throw new NotFoundError('Account not found');
      }

      if (account.user_id !== userId) {
        throw new ForbiddenError('Access denied to this account');
      }

      // 2. Verificar saldo disponível
      if (Number(account.available_balance) < data.amount) {
        throw new InsufficientBalanceError(
          `Insufficient balance. Available: R$ ${account.available_balance}, Required: R$ ${data.amount}`
        );
      }

      // 3. Débito imediato
      const updatedAccount = await tx.account.update({
        where: { id: data.accountId },
        data: {
          total_balance: { decrement: data.amount },
          available_balance: { decrement: data.amount },
          updated_at: new Date(),
        },
      });

      // 4. Criar transação executada
      const transaction = await tx.transaction.create({
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

      // 5. Snapshot
      await tx.balanceHistory.create({
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

      // 6. Invalidar cache de sugestão
      await SuggestionEngine.invalidateCache(data.accountId);

      return {
        transaction,
        account_balances: {
          total_balance: updatedAccount.total_balance,
          available_balance: updatedAccount.available_balance,
        },
      };
    });
  }

  /**
   * Lista transações com filtros
   */
  async list(userId: string, filters: {
    accountId?: string;
    type?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    categoryId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    // Construir where clause
    const where: any = {};

    // Se accountId fornecido, verificar se pertence ao usuário
    if (filters.accountId) {
      const account = await prisma.account.findUnique({
        where: { id: filters.accountId },
      });

      if (!account || account.user_id !== userId) {
        throw new ForbiddenError('Access denied to this account');
      }

      where.account_id = filters.accountId;
    } else {
      // Buscar todas as contas do usuário
      const userAccounts = await prisma.account.findMany({
        where: { user_id: userId },
        select: { id: true },
      });

      where.account_id = {
        in: userAccounts.map(a => a.id),
      };
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.categoryId) {
      where.category_id = filters.categoryId;
    }

    if (filters.startDate || filters.endDate) {
      where.due_date = {};
      if (filters.startDate) {
        where.due_date.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.due_date.lte = filters.endDate;
      }
    }

    // Buscar transações
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              type: true,
              color: true,
              icon: true,
            },
          },
          account: {
            select: {
              id: true,
              account_name: true,
            },
          },
        },
        orderBy: [
          { due_date: 'desc' },
          { created_at: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      transactions,
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_items: total,
        items_per_page: limit,
      },
    };
  }

  /**
   * Busca transação por ID
   */
  async getById(userId: string, transactionId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        category: true,
        account: true,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    // Verificar se a conta pertence ao usuário
    if (transaction.account.user_id !== userId) {
      throw new ForbiddenError('Access denied to this transaction');
    }

    return transaction;
  }

  /**
   * Deleta uma transação (apenas se pending ou locked)
   */
  async delete(userId: string, transactionId: string) {
    const transaction = await this.getById(userId, transactionId);

    // Só permite deletar se não foi executada
    if (transaction.status === 'executed') {
      throw new ValidationError('Cannot delete executed transaction');
    }

    return await prisma.$transaction(async (tx) => {
      // Se estava bloqueada, liberar o saldo
      if (transaction.status === 'locked') {
        await tx.account.update({
          where: { id: transaction.account_id },
          data: {
            available_balance: { increment: Number(transaction.amount) },
            locked_balance: { decrement: Number(transaction.amount) },
          },
        });
      }

      // Deletar transação
      await tx.transaction.delete({
        where: { id: transactionId },
      });

      return { message: 'Transaction deleted successfully' };
    });
  }
}
