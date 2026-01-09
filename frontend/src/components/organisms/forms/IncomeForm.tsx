import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Stack, Checkbox, Center, Text } from '@chakra-ui/react';
import { Button } from '../../atoms/Button';
import { FormField } from '../../molecules/FormField';
import { FormSelect } from '../../molecules/FormSelect';
import { InfoBox } from '../../molecules/InfoBox';
import { useCreateIncome } from '../../../hooks/useTransactions';
import { useAccounts } from '../../../hooks/useAccounts';
import { useCategories } from '../../../hooks/useCategories';
import type { CreateIncomeDTO } from '../../../types/transaction';

const incomeSchema = z.object({
  accountId: z.string().min(1, 'Conta é obrigatória'),
  amount: z.number().positive('Valor deve ser positivo'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  categoryId: z.string().min(1, 'Categoria é obrigatória'),
  dueDate: z.string()
    .optional()
    .transform((val) => {
      if (!val || val === '') return undefined;
      // Convert datetime-local format to ISO string
      return new Date(val).toISOString();
    }),
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
    return (
      <Center py={4}>
        <Text>Carregando...</Text>
      </Center>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <Center py={4}>
        <Stack spacing={4} align="center">
          <Text color="gray.600">Você precisa criar uma conta primeiro.</Text>
          <Button onClick={onCancel}>Voltar</Button>
        </Stack>
      </Center>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={4}>
        <FormSelect
          label="Conta"
          isRequired
          error={errors.accountId?.message}
          {...register('accountId')}
        >
          <option value="">Selecione uma conta</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.account_name} - R$ {Number(account.available_balance).toFixed(2)}
            </option>
          ))}
        </FormSelect>

        <FormField
          label="Valor"
          type="number"
          step="0.01"
          placeholder="0.00"
          isRequired
          error={errors.amount?.message}
          {...register('amount', { valueAsNumber: true })}
        />

        <FormField
          label="Descrição"
          type="text"
          placeholder="Ex: Salário, Freelance, etc."
          isRequired
          error={errors.description?.message}
          {...register('description')}
        />

        <FormSelect
          label="Categoria"
          isRequired
          error={errors.categoryId?.message}
          {...register('categoryId')}
        >
          <option value="">Selecione uma categoria</option>
          {categories?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </FormSelect>

        <FormField
          label="Data de Recebimento (opcional)"
          type="datetime-local"
          {...register('dueDate')}
        />

        <Checkbox {...register('isRecurring')} colorScheme="brand">
          Receita recorrente
        </Checkbox>

        {createIncome.isError && (
          <InfoBox variant="error">
            {createIncome.error instanceof Error
              ? createIncome.error.message
              : 'Erro ao criar receita'}
          </InfoBox>
        )}

        <Stack direction="row" spacing={3} pt={4}>
          <Button
            type="submit"
            isLoading={isSubmitting || createIncome.isPending}
            loadingText="Criando..."
            flex="1"
          >
            Criar Receita
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
        </Stack>
      </Stack>
    </form>
  );
}
