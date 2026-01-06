import { PrismaClient } from '@prisma/client';
import { ValidationError, ForbiddenError, NotFoundError } from '../middlewares/errorHandler';
import { CreateAccountDTO, UpdateAccountDTO } from '../types';

const prisma = new PrismaClient();

export class AccountService {
  /**
   * Lista todas as contas de um usuário
   */
  async listByUser(userId: string) {
    const accounts = await prisma.account.findMany({
      where: { user_id: userId },
      orderBy: [
        { is_default: 'desc' },
        { created_at: 'asc' },
      ],
      select: {
        id: true,
        account_name: true,
        account_type: true,
        total_balance: true,
        available_balance: true,
        locked_balance: true,
        emergency_reserve: true,
        currency: true,
        is_default: true,
        created_at: true,
        updated_at: true,
      },
    });

    return accounts;
  }

  /**
   * Busca uma conta específica
   */
  async getById(accountId: string, userId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        financial_rules: {
          where: { is_active: true },
          orderBy: { priority: 'asc' },
        },
      },
    });

    if (!account) {
      throw new NotFoundError('Account not found');
    }

    // Verificar se a conta pertence ao usuário
    if (account.user_id !== userId) {
      throw new ForbiddenError('Access denied to this account');
    }

    return account;
  }

  /**
   * Cria uma nova conta
   */
  async create(userId: string, data: CreateAccountDTO) {
    // Validar dados
    if (!data.account_name || data.account_name.trim().length === 0) {
      throw new ValidationError('Account name is required');
    }

    // Se é para ser padrão, remover padrão das outras
    if (data.is_default) {
      await prisma.account.updateMany({
        where: { user_id: userId, is_default: true },
        data: { is_default: false },
      });
    }

    // Criar conta e regra de reserva em transação
    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          user_id: userId,
          account_name: data.account_name,
          account_type: data.account_type || 'checking',
          is_default: data.is_default ?? false,
        },
      });

      // Criar regra de reserva de emergência padrão
      await tx.financialRule.create({
        data: {
          account_id: account.id,
          rule_type: 'emergency_reserve',
          rule_name: 'Reserva de Emergência Automática',
          percentage: 30,
          priority: 1,
          is_active: true,
        },
      });

      return account;
    });

    return result;
  }

  /**
   * Atualiza uma conta
   */
  async update(accountId: string, userId: string, data: UpdateAccountDTO) {
    // Verificar se conta existe e pertence ao usuário
    await this.getById(accountId, userId);

    // Se está definindo como padrão, remover padrão das outras
    if (data.is_default) {
      await prisma.account.updateMany({
        where: { user_id: userId, is_default: true, id: { not: accountId } },
        data: { is_default: false },
      });
    }

    const account = await prisma.account.update({
      where: { id: accountId },
      data: {
        account_name: data.account_name,
        is_default: data.is_default,
        updated_at: new Date(),
      },
    });

    return account;
  }

  /**
   * Deleta uma conta (apenas se não tiver transações)
   */
  async delete(accountId: string, userId: string) {
    // Verificar se conta existe e pertence ao usuário
    const account = await this.getById(accountId, userId);

    // Verificar se tem transações
    const transactionCount = await prisma.transaction.count({
      where: { account_id: accountId },
    });

    if (transactionCount > 0) {
      throw new ValidationError(
        'Cannot delete account with transactions. Please transfer or delete all transactions first.'
      );
    }

    // Verificar se tem saldo
    if (Number(account.total_balance) !== 0) {
      throw new ValidationError('Cannot delete account with non-zero balance');
    }

    // Deletar conta (cascade vai deletar regras e histórico)
    await prisma.account.delete({
      where: { id: accountId },
    });

    return { message: 'Account deleted successfully' };
  }

  /**
   * Busca conta padrão do usuário
   */
  async getDefaultAccount(userId: string) {
    const account = await prisma.account.findFirst({
      where: { user_id: userId, is_default: true },
    });

    if (!account) {
      // Se não tem padrão, pegar a primeira
      const firstAccount = await prisma.account.findFirst({
        where: { user_id: userId },
      });

      if (!firstAccount) {
        throw new NotFoundError('No accounts found for this user');
      }

      return firstAccount;
    }

    return account;
  }
}
