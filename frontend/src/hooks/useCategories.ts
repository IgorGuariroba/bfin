import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { Category } from '../types/transaction';

export function useCategories(type?: 'income' | 'expense') {
  return useQuery({
    queryKey: ['categories', type],
    queryFn: async () => {
      // TODO: Create categories endpoint in backend
      // For now, mock the data or return empty array
      const response = await api.get<Category[]>('/categories', {
        params: type ? { type } : undefined,
      });
      return response.data;
    },
    retry: 1,
  });
}
