export type TransactionType = 'income' | 'fixed_expense' | 'variable_expense';
export type TransactionStatus = 'pending' | 'executed' | 'cancelled' | 'locked';
export type RecurrencePattern = 'monthly' | 'weekly' | 'yearly';

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color?: string;
  icon?: string;
}

export interface Account {
  id: string;
  account_name: string;
  account_type: string;
  total_balance: number;
  available_balance: number;
  locked_balance: number;
  emergency_reserve: number;
  currency: string;
  is_default: boolean;
}

export interface Transaction {
  id: string;
  account_id: string;
  category_id: string;
  type: TransactionType;
  amount: number;
  description: string;
  due_date: string;
  executed_date?: string;
  status: TransactionStatus;
  is_recurring: boolean;
  recurrence_pattern?: RecurrencePattern;
  recurrence_end_date?: string;
  tags: string[];
  attachment_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  category?: Category;
  account?: Account;
}

export interface CreateIncomeDTO {
  accountId: string;
  amount: number;
  description: string;
  categoryId: string;
  dueDate?: string;
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
}

export interface CreateFixedExpenseDTO {
  accountId: string;
  amount: number;
  description: string;
  categoryId: string;
  dueDate: string;
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
}

export interface CreateVariableExpenseDTO {
  accountId: string;
  amount: number;
  description: string;
  categoryId: string;
}

export interface TransactionBreakdown {
  total_received: number;
  emergency_reserve: number;
  available: number;
}

export interface AccountBalances {
  total_balance: number;
  available_balance: number;
  locked_balance: number;
  emergency_reserve?: number;
}

export interface CreateTransactionResponse {
  transaction: Transaction;
  breakdown?: TransactionBreakdown;
  account_balances: AccountBalances;
}

export interface ListTransactionsParams {
  accountId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_items: number;
    items_per_page: number;
  };
}
