import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface DailyLimitSuggestion {
  accountId: string;
  dailyLimit: number;
  availableBalance: number;
  daysConsidered: number;
  calculatedAt: Date;
}

interface SuggestionHistory {
  id: string;
  dailyLimit: number;
  availableBalance: number;
  createdAt: Date;
}

export class SuggestionEngine {
  private static DAYS_FOR_CALCULATION = 30;
  private static CACHE_TTL_SECONDS = 86400; // 24 horas

  /**
   * Calcula o limite diário de gastos
   * Fórmula: Saldo Disponível / 30 dias
   */
  static async calculateDailyLimit(accountId: string): Promise<DailyLimitSuggestion> {
    // Verificar cache no Redis
    const cacheKey = `daily-limit:${accountId}`;
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      const cached = JSON.parse(cachedData);
      return {
        ...cached,
        calculatedAt: new Date(cached.calculatedAt),
      };
    }

    // Buscar conta
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        available_balance: true,
        locked_balance: true,
        user_id: true,
      },
    });

    if (!account) {
      throw new Error('Account not found');
    }

    // Converter Decimal para número
    const availableBalance = Number(account.available_balance);

    // Calcular limite diário
    const dailyLimit = availableBalance / this.DAYS_FOR_CALCULATION;

    const suggestion: DailyLimitSuggestion = {
      accountId: account.id,
      dailyLimit: Math.max(0, dailyLimit), // Não pode ser negativo
      availableBalance,
      daysConsidered: this.DAYS_FOR_CALCULATION,
      calculatedAt: new Date(),
    };

    // Salvar no banco de dados
    const now = new Date();
    const validUntil = new Date();
    validUntil.setHours(23, 59, 59, 999); // Válido até o final do dia

    await prisma.spendingSuggestion.create({
      data: {
        account_id: account.id,
        suggestion_date: now,
        valid_until: validUntil,
        daily_limit: dailyLimit,
        monthly_projection: dailyLimit * 30,
        available_balance_snapshot: availableBalance,
        locked_balance_snapshot: Number(account.locked_balance),
        days_until_next_income: this.DAYS_FOR_CALCULATION,
        average_daily_expense: null,
        calculation_metadata: {
          method: 'simple_division',
          formula: 'available_balance / 30',
        },
      },
    });

    // Cachear no Redis (24h)
    await redis.setex(cacheKey, this.CACHE_TTL_SECONDS, JSON.stringify(suggestion));

    return suggestion;
  }

  /**
   * Obtém o limite diário atual (do cache ou calcula)
   */
  static async getDailyLimit(accountId: string): Promise<DailyLimitSuggestion> {
    return this.calculateDailyLimit(accountId);
  }

  /**
   * Recalcula o limite diário (força atualização do cache)
   */
  static async recalculateDailyLimit(accountId: string): Promise<DailyLimitSuggestion> {
    // Invalidar cache
    const cacheKey = `daily-limit:${accountId}`;
    await redis.del(cacheKey);

    // Calcular novamente
    return this.calculateDailyLimit(accountId);
  }

  /**
   * Obtém o histórico de sugestões
   */
  static async getHistory(
    accountId: string,
    limit: number = 30
  ): Promise<SuggestionHistory[]> {
    const suggestions = await prisma.spendingSuggestion.findMany({
      where: { account_id: accountId },
      select: {
        id: true,
        daily_limit: true,
        available_balance_snapshot: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return suggestions.map((s) => ({
      id: s.id,
      dailyLimit: Number(s.daily_limit),
      availableBalance: Number(s.available_balance_snapshot),
      createdAt: s.created_at,
    }));
  }

  /**
   * Calcula quanto já foi gasto hoje
   */
  static async getSpentToday(accountId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const expenses = await prisma.transaction.aggregate({
      where: {
        account_id: accountId,
        type: 'variable_expense',
        status: 'executed',
        executed_date: {
          gte: today,
          lt: tomorrow,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return Number(expenses._sum.amount || 0);
  }

  /**
   * Verifica se o limite diário foi excedido
   */
  static async isLimitExceeded(accountId: string): Promise<{
    exceeded: boolean;
    dailyLimit: number;
    spentToday: number;
    remaining: number;
    percentageUsed: number;
  }> {
    const { dailyLimit } = await this.getDailyLimit(accountId);
    const spentToday = await this.getSpentToday(accountId);

    const remaining = dailyLimit - spentToday;
    const percentageUsed = dailyLimit > 0 ? (spentToday / dailyLimit) * 100 : 0;

    return {
      exceeded: spentToday > dailyLimit,
      dailyLimit,
      spentToday,
      remaining: Math.max(0, remaining),
      percentageUsed: Math.min(100, percentageUsed),
    };
  }

  /**
   * Invalidar cache após transação
   */
  static async invalidateCache(accountId: string): Promise<void> {
    const cacheKey = `daily-limit:${accountId}`;
    await redis.del(cacheKey);
  }
}
