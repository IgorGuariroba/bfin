import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transactionService } from '../services/transactionService';
import type {
  CreateIncomeDTO,
  CreateFixedExpenseDTO,
  CreateVariableExpenseDTO,
  ListTransactionsParams,
} from '../types/transaction';

export function useTransactions(params?: ListTransactionsParams) {
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: () => transactionService.list(params),
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: ['transaction', id],
    queryFn: () => transactionService.getById(id),
    enabled: !!id,
  });
}

export function useCreateIncome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateIncomeDTO) => transactionService.createIncome(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['daily-limit'] });
      queryClient.invalidateQueries({ queryKey: ['daily-limit-status'] });
      queryClient.invalidateQueries({ queryKey: ['total-daily-limit'] });
    },
  });
}

export function useCreateFixedExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFixedExpenseDTO) => transactionService.createFixedExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['daily-limit'] });
      queryClient.invalidateQueries({ queryKey: ['daily-limit-status'] });
      queryClient.invalidateQueries({ queryKey: ['total-daily-limit'] });
    },
  });
}

export function useCreateVariableExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVariableExpenseDTO) => transactionService.createVariableExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['daily-limit'] });
      queryClient.invalidateQueries({ queryKey: ['daily-limit-status'] });
      queryClient.invalidateQueries({ queryKey: ['total-daily-limit'] });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => transactionService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['daily-limit'] });
      queryClient.invalidateQueries({ queryKey: ['daily-limit-status'] });
      queryClient.invalidateQueries({ queryKey: ['total-daily-limit'] });
    },
  });
}

export function useUpcomingFixedExpenses() {
  return useQuery({
    queryKey: ['transactions', { type: 'fixed_expense', status: 'locked' }],
    queryFn: () => transactionService.list({
      type: 'fixed_expense',
      status: 'locked',
      limit: 10
    }),
  });
}
