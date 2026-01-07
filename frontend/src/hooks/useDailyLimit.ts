import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

interface DailyLimitResponse {
  accountId: string;
  dailyLimit: number;
  availableBalance: number;
  daysConsidered: number;
  spentToday: number;
  remaining: number;
  percentageUsed: number;
  exceeded: boolean;
  calculatedAt: string;
}

interface DailyLimitStatusResponse {
  accountId: string;
  exceeded: boolean;
  dailyLimit: number;
  spentToday: number;
  remaining: number;
  percentageUsed: number;
}

/**
 * Hook para buscar o limite diário de gastos de uma conta
 */
export function useDailyLimit(accountId?: string) {
  return useQuery<DailyLimitResponse>({
    queryKey: ['daily-limit', accountId],
    queryFn: async () => {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const response = await api.get<DailyLimitResponse>(
        `/suggestions/daily-limit?account_id=${accountId}`
      );
      return response.data;
    },
    enabled: !!accountId, // Só executa se accountId existir
    staleTime: 1000 * 60 * 5, // 5 minutos
    refetchInterval: 1000 * 60 * 5, // Atualiza a cada 5 minutos
  });
}

/**
 * Hook para buscar apenas o status do limite (mais leve)
 */
export function useDailyLimitStatus(accountId?: string) {
  return useQuery<DailyLimitStatusResponse>({
    queryKey: ['daily-limit-status', accountId],
    queryFn: async () => {
      if (!accountId) {
        throw new Error('Account ID is required');
      }

      const response = await api.get<DailyLimitStatusResponse>(
        `/suggestions/status?account_id=${accountId}`
      );
      return response.data;
    },
    enabled: !!accountId,
    staleTime: 1000 * 60, // 1 minuto
    refetchInterval: 1000 * 60, // Atualiza a cada 1 minuto
  });
}

/**
 * Hook para buscar o limite diário combinado de todas as contas
 */
export function useTotalDailyLimit(accountIds: string[]) {
  return useQuery<{
    totalDailyLimit: number;
    totalSpentToday: number;
    totalRemaining: number;
    percentageUsed: number;
    exceeded: boolean;
  }>({
    queryKey: ['total-daily-limit', accountIds],
    queryFn: async () => {
      if (!accountIds || accountIds.length === 0) {
        return {
          totalDailyLimit: 0,
          totalSpentToday: 0,
          totalRemaining: 0,
          percentageUsed: 0,
          exceeded: false,
        };
      }

      // Buscar limite de cada conta
      const promises = accountIds.map((accountId) =>
        api.get<DailyLimitResponse>(`/suggestions/daily-limit?account_id=${accountId}`)
      );

      const responses = await Promise.all(promises);

      // Somar todos os limites
      const totals = responses.reduce(
        (acc, response) => {
          const data = response.data;
          return {
            totalDailyLimit: acc.totalDailyLimit + data.dailyLimit,
            totalSpentToday: acc.totalSpentToday + data.spentToday,
            totalRemaining: acc.totalRemaining + data.remaining,
          };
        },
        { totalDailyLimit: 0, totalSpentToday: 0, totalRemaining: 0 }
      );

      const percentageUsed =
        totals.totalDailyLimit > 0
          ? (totals.totalSpentToday / totals.totalDailyLimit) * 100
          : 0;

      return {
        ...totals,
        percentageUsed: Math.min(100, percentageUsed),
        exceeded: totals.totalSpentToday > totals.totalDailyLimit,
      };
    },
    enabled: accountIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}
