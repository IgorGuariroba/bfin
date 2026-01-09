import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Stack, Center, Text } from '@chakra-ui/react';
import { Button } from '../../atoms/Button';
import { FormField } from '../../molecules/FormField';
import { FormSelect } from '../../molecules/FormSelect';
import { InfoBox } from '../../molecules/InfoBox';
import { useCreateVariableExpense } from '../../../hooks/useTransactions';
import { useAccounts } from '../../../hooks/useAccounts';
import { useCategories } from '../../../hooks/useCategories';
import type { CreateVariableExpenseDTO } from '../../../types/transaction';

const variableExpenseSchema = z.object({
  accountId: z.string().min(1, 'Conta é obrigatória'),
  amount: z.number().positive('Valor deve ser positivo'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  categoryId: z.string().min(1, 'Categoria é obrigatória'),
});

type VariableExpenseFormData = z.infer<typeof variableExpenseSchema>;

interface VariableExpenseFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function VariableExpenseForm({ onSuccess, onCancel }: VariableExpenseFormProps) {
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const { data: categories, isLoading: loadingCategories } = useCategories('expense');
  const createVariableExpense = useCreateVariableExpense();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VariableExpenseFormData>({
    resolver: zodResolver(variableExpenseSchema),
  });

  const onSubmit = async (data: VariableExpenseFormData) => {
    try {
      const payload: CreateVariableExpenseDTO = {
        ...data,
        amount: Number(data.amount),
      };

      await createVariableExpense.mutateAsync(payload);

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error creating variable expense:', error);
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
          placeholder="Ex: Supermercado, Uber, Restaurante, etc."
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

        {createVariableExpense.isError && (
          <InfoBox variant="error">
            {createVariableExpense.error instanceof Error
              ? createVariableExpense.error.message
              : 'Erro ao criar despesa variável'}
          </InfoBox>
        )}

        <InfoBox variant="warning">
          <Text fontWeight="semibold">Como funciona:</Text>
          <Text as="ul" sx={{ listStyleType: 'disc' }} pl={4} mt={1} fontSize="sm">
            <li>O valor será <strong>debitado imediatamente</strong> da sua conta</li>
            <li>Perfeito para gastos do dia a dia</li>
            <li>Reduz o saldo disponível na hora</li>
          </Text>
        </InfoBox>

        <Stack direction="row" spacing={3} pt={4}>
          <Button
            type="submit"
            isLoading={isSubmitting || createVariableExpense.isPending}
            loadingText="Criando..."
            flex="1"
          >
            Criar Despesa Variável
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
