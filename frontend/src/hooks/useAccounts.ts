import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { Account } from '../types/transaction';

interface AccountsResponse {
  accounts: Account[];
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await api.get<AccountsResponse>('/accounts');
      return response.data.accounts;
    },
  });
}
