import api from './api';
import type {
  CreateIncomeDTO,
  CreateFixedExpenseDTO,
  CreateVariableExpenseDTO,
  CreateTransactionResponse,
  ListTransactionsParams,
  TransactionListResponse,
  Transaction,
} from '../types/transaction';

export const transactionService = {
  /**
   * Create income transaction
   */
  async createIncome(data: CreateIncomeDTO): Promise<CreateTransactionResponse> {
    const response = await api.post('/transactions/income', data);
    return response.data;
  },

  /**
   * Create fixed expense transaction
   */
  async createFixedExpense(data: CreateFixedExpenseDTO): Promise<CreateTransactionResponse> {
    const response = await api.post('/transactions/fixed-expense', data);
    return response.data;
  },

  /**
   * Create variable expense transaction
   */
  async createVariableExpense(data: CreateVariableExpenseDTO): Promise<CreateTransactionResponse> {
    const response = await api.post('/transactions/variable-expense', data);
    return response.data;
  },

  /**
   * List transactions with filters
   */
  async list(params?: ListTransactionsParams): Promise<TransactionListResponse> {
    const response = await api.get('/transactions', { params });
    return response.data;
  },

  /**
   * Get transaction by ID
   */
  async getById(id: string): Promise<Transaction> {
    const response = await api.get(`/transactions/${id}`);
    return response.data;
  },

  /**
   * Delete transaction
   */
  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/transactions/${id}`);
    return response.data;
  },
};
