import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCreateIncome } from '../../hooks/useTransactions';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import type { CreateIncomeDTO } from '../../types/transaction';

const incomeSchema = z.object({
  accountId: z.string().min(1, 'Conta é obrigatória'),
  amount: z.number().positive('Valor deve ser positivo'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  categoryId: z.string().min(1, 'Categoria é obrigatória'),
  dueDate: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.enum(['monthly', 'weekly', 'yearly']).optional(),
});

type IncomeFormData = z.infer<typeof incomeSchema>;

interface IncomeFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function IncomeForm({ onSuccess, onCancel }: IncomeFormProps) {
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const { data: categories, isLoading: loadingCategories } = useCategories('income');
  const createIncome = useCreateIncome();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<IncomeFormData>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      isRecurring: false,
    },
  });

  const onSubmit = async (data: IncomeFormData) => {
    try {
      // Convert amount to number if it's a string
      const payload: CreateIncomeDTO = {
        ...data,
        amount: Number(data.amount),
      };

      await createIncome.mutateAsync(payload);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error creating income:', error);
    }
  };

  if (loadingAccounts || loadingCategories) {
    return <div className="text-center py-4">Carregando...</div>;
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-600 mb-4">Você precisa criar uma conta primeiro.</p>
        <Button onClick={onCancel}>Voltar</Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Account Selection */}
      <div>
        <label htmlFor="accountId" className="block text-sm font-medium text-gray-700 mb-1">
          Conta *
        </label>
        <select
          id="accountId"
          {...register('accountId')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione uma conta</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.account_name} - R$ {Number(account.available_balance).toFixed(2)}
            </option>
          ))}
        </select>
        {errors.accountId && (
          <p className="text-red-500 text-sm mt-1">{errors.accountId.message}</p>
        )}
      </div>

      {/* Amount */}
      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
          Valor *
        </label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          placeholder="0.00"
          {...register('amount', { valueAsNumber: true })}
        />
        {errors.amount && (
          <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Descrição *
        </label>
        <Input
          id="description"
          type="text"
          placeholder="Ex: Salário, Freelance, etc."
          {...register('description')}
        />
        {errors.description && (
          <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>
        )}
      </div>

      {/* Category */}
      <div>
        <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-1">
          Categoria *
        </label>
        <select
          id="categoryId"
          {...register('categoryId')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Selecione uma categoria</option>
          {categories?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {errors.categoryId && (
          <p className="text-red-500 text-sm mt-1">{errors.categoryId.message}</p>
        )}
      </div>

      {/* Due Date (optional) */}
      <div>
        <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
          Data de Recebimento (opcional)
        </label>
        <Input
          id="dueDate"
          type="datetime-local"
          {...register('dueDate')}
        />
      </div>

      {/* Recurring */}
      <div className="flex items-center">
        <input
          id="isRecurring"
          type="checkbox"
          {...register('isRecurring')}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="isRecurring" className="ml-2 block text-sm text-gray-700">
          Receita recorrente
        </label>
      </div>

      {/* Error Message */}
      {createIncome.isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {createIncome.error instanceof Error
            ? createIncome.error.message
            : 'Erro ao criar receita'}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          disabled={isSubmitting || createIncome.isPending}
          className="flex-1"
        >
          {createIncome.isPending ? 'Criando...' : 'Criar Receita'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
