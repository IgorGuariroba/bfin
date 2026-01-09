import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Stack, Checkbox, Center, Text } from '@chakra-ui/react';
import { Button } from '../../atoms/Button';
import { FormField } from '../../molecules/FormField';
import { FormSelect } from '../../molecules/FormSelect';
import { InfoBox } from '../../molecules/InfoBox';
import { useCreateFixedExpense } from '../../../hooks/useTransactions';
import { useAccounts } from '../../../hooks/useAccounts';
import { useCategories } from '../../../hooks/useCategories';
import type { CreateFixedExpenseDTO } from '../../../types/transaction';

const fixedExpenseSchema = z.object({
  accountId: z.string().min(1, 'Conta é obrigatória'),
  amount: z.number().positive('Valor deve ser positivo'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  categoryId: z.string().min(1, 'Categoria é obrigatória'),
  dueDate: z.string()
    .min(1, 'Data de vencimento é obrigatória')
    .transform((val) => {
      return new Date(val).toISOString();
    }),
  isRecurring: z.boolean().optional(),
  recurrencePattern: z.enum(['monthly', 'weekly', 'yearly']).optional(),
});

type FixedExpenseFormData = z.infer<typeof fixedExpenseSchema>;

interface FixedExpenseFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function FixedExpenseForm({ onSuccess, onCancel }: FixedExpenseFormProps) {
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const { data: categories, isLoading: loadingCategories } = useCategories('expense');
  const createFixedExpense = useCreateFixedExpense();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FixedExpenseFormData>({
    resolver: zodResolver(fixedExpenseSchema),
    defaultValues: {
      isRecurring: false,
    },
  });

  const onSubmit = async (data: FixedExpenseFormData) => {
    try {
      const payload: CreateFixedExpenseDTO = {
        ...data,
        amount: Number(data.amount),
      };

      await createFixedExpense.mutateAsync(payload);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error creating fixed expense:', error);
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
          placeholder="Ex: Aluguel, Luz, Internet, etc."
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
          label="Data de Vencimento"
          type="datetime-local"
          isRequired
          error={errors.dueDate?.message}
          helperText="O valor será bloqueado preventivamente até a data de vencimento"
          {...register('dueDate')}
        />

        <Checkbox {...register('isRecurring')} colorScheme="brand">
          Despesa recorrente (mensalmente)
        </Checkbox>

        {createFixedExpense.isError && (
          <InfoBox variant="error">
            {createFixedExpense.error instanceof Error
              ? createFixedExpense.error.message
              : 'Erro ao criar despesa fixa'}
          </InfoBox>
        )}

        <InfoBox variant="info">
          <Text fontWeight="semibold">Como funciona:</Text>
          <Text as="ul" sx={{ listStyleType: 'disc' }} pl={4} mt={1} fontSize="sm">
            <li>O valor será <strong>bloqueado</strong> do seu saldo disponível</li>
            <li>Ficará em "saldo bloqueado" até a data de vencimento</li>
            <li>No vencimento, o valor será debitado</li>
          </Text>
        </InfoBox>

        <Stack direction="row" spacing={3} pt={4}>
          <Button
            type="submit"
            isLoading={isSubmitting || createFixedExpense.isPending}
            loadingText="Criando..."
            flex="1"
          >
            Criar Despesa Fixa
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
