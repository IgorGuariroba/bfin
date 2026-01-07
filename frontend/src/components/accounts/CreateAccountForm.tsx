import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import api from '../../services/api';

const createAccountSchema = z.object({
  account_name: z.string().min(1, 'Nome da conta é obrigatório'),
  account_type: z.enum(['checking', 'savings', 'investment']).optional(),
  is_default: z.boolean().optional(),
});

type CreateAccountFormData = z.infer<typeof createAccountSchema>;

interface CreateAccountFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateAccountForm({ onSuccess, onCancel }: CreateAccountFormProps) {
  const queryClient = useQueryClient();

  const createAccount = useMutation({
    mutationFn: async (data: CreateAccountFormData) => {
      const response = await api.post('/accounts', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      if (onSuccess) {
        onSuccess();
      }
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateAccountFormData>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      account_type: 'checking',
      is_default: true,
    },
  });

  const onSubmit = async (data: CreateAccountFormData) => {
    try {
      await createAccount.mutateAsync(data);
    } catch (error) {
      console.error('Error creating account:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Account Name */}
      <div>
        <label htmlFor="account_name" className="block text-sm font-medium text-gray-700 mb-1">
          Nome da Conta *
        </label>
        <Input
          id="account_name"
          type="text"
          placeholder="Ex: Conta Corrente, Nubank, etc."
          {...register('account_name')}
        />
        {errors.account_name && (
          <p className="text-red-500 text-sm mt-1">{errors.account_name.message}</p>
        )}
      </div>

      {/* Account Type */}
      <div>
        <label htmlFor="account_type" className="block text-sm font-medium text-gray-700 mb-1">
          Tipo de Conta
        </label>
        <select
          id="account_type"
          {...register('account_type')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="checking">Conta Corrente</option>
          <option value="savings">Poupança</option>
          <option value="investment">Investimentos</option>
        </select>
      </div>

      {/* Default Account */}
      <div className="flex items-center">
        <input
          id="is_default"
          type="checkbox"
          {...register('is_default')}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="is_default" className="ml-2 block text-sm text-gray-700">
          Definir como conta padrão
        </label>
      </div>

      {/* Error Message */}
      {createAccount.isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {createAccount.error instanceof Error
            ? createAccount.error.message
            : 'Erro ao criar conta'}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          disabled={isSubmitting || createAccount.isPending}
          className="flex-1"
        >
          {createAccount.isPending ? 'Criando...' : 'Criar Conta'}
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
