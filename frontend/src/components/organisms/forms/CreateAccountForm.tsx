import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, Checkbox } from '@chakra-ui/react';
import { Button } from '../../atoms/Button';
import { FormField } from '../../molecules/FormField';
import { FormSelect } from '../../molecules/FormSelect';
import { InfoBox } from '../../molecules/InfoBox';
import api from '../../../services/api';

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
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack spacing={4}>
        <FormField
          label="Nome da Conta"
          placeholder="Ex: Conta Corrente, Nubank, etc."
          isRequired
          error={errors.account_name?.message}
          {...register('account_name')}
        />

        <FormSelect
          label="Tipo de Conta"
          {...register('account_type')}
        >
          <option value="checking">Conta Corrente</option>
          <option value="savings">Poupança</option>
          <option value="investment">Investimentos</option>
        </FormSelect>

        <Checkbox {...register('is_default')} colorScheme="brand">
          Definir como conta padrão
        </Checkbox>

        {createAccount.isError && (
          <InfoBox variant="error">
            {createAccount.error instanceof Error
              ? createAccount.error.message
              : 'Erro ao criar conta'}
          </InfoBox>
        )}

        <Stack direction="row" spacing={3} pt={4}>
          <Button
            type="submit"
            isLoading={isSubmitting || createAccount.isPending}
            loadingText="Criando..."
            flex="1"
          >
            Criar Conta
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              Cancelar
            </Button>
          )}
        </Stack>
      </Stack>
    </form>
  );
}
