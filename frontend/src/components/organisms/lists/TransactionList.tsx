import { useState } from 'react';
import {
  Box,
  Flex,
  Text,
  Stack,
  Spinner,
  Center,
  Icon,
  IconButton,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
} from '@chakra-ui/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowUpCircle, ArrowDownCircle, Lock, Pencil, Trash2, CheckCircle, Copy } from 'lucide-react';
import { Button } from '../../atoms/Button';
import { FormField } from '../../molecules/FormField';
import { FormSelect } from '../../molecules/FormSelect';
import { StatusBadge } from '../../molecules/StatusBadge';
import { useTransactions, useDeleteTransaction, useUpdateTransaction, useMarkAsPaid, useDuplicateTransaction } from '../../../hooks/useTransactions';
import { useCategories } from '../../../hooks/useCategories';

interface TransactionListProps {
  accountId?: string;
}

export function TransactionList({ accountId }: TransactionListProps) {
  const { data, isLoading, isError } = useTransactions({ accountId });
  const deleteTransaction = useDeleteTransaction();
  const updateTransaction = useUpdateTransaction();
  const markAsPaid = useMarkAsPaid();
  const duplicateTransaction = useDuplicateTransaction();
  const { data: categoriesData } = useCategories();

  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    amount: 0,
    description: '',
    categoryId: '',
    dueDate: '',
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const getTransactionIcon = (type: string, status: string) => {
    if (status === 'locked') {
      return Lock;
    }
    if (type === 'income') {
      return ArrowUpCircle;
    }
    return ArrowDownCircle;
  };

  const getTransactionColor = (type: string, status: string) => {
    if (status === 'locked') return 'blue.600';
    if (type === 'income') return 'green.600';
    return 'red.600';
  };

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      income: 'Receita',
      fixed_expense: 'Despesa Fixa',
      variable_expense: 'Despesa Variável',
    };
    return typeMap[type] || type;
  };

  const handleEdit = (transaction: any) => {
    setEditingTransaction(transaction);
    setEditForm({
      amount: Number(transaction.amount),
      description: transaction.description,
      categoryId: transaction.category_id,
      dueDate: transaction.due_date ? format(new Date(transaction.due_date), 'yyyy-MM-dd') : '',
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta transação?')) {
      try {
        await deleteTransaction.mutateAsync(id);
      } catch (error: any) {
        alert(error.response?.data?.error || 'Erro ao excluir transação');
      }
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    try {
      await updateTransaction.mutateAsync({
        id: editingTransaction.id,
        data: {
          ...editForm,
          dueDate: editForm.dueDate ? new Date(editForm.dueDate).toISOString() : undefined,
        },
      });
      setEditingTransaction(null);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao atualizar transação');
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    if (window.confirm('Deseja marcar esta despesa fixa como paga?')) {
      try {
        await markAsPaid.mutateAsync(id);
      } catch (error: any) {
        alert(error.response?.data?.error || 'Erro ao marcar como paga');
      }
    }
  };

  const handleDuplicate = async (id: string, description: string) => {
    if (window.confirm(`Deseja duplicar "${description}"?`)) {
      try {
        await duplicateTransaction.mutateAsync(id);
      } catch (error: any) {
        alert(error.response?.data?.error || 'Erro ao duplicar transação');
      }
    }
  };

  if (isLoading) {
    return (
      <Center py={8}>
        <Stack spacing={2} align="center">
          <Spinner size="lg" color="brand.600" />
          <Text color="gray.600">Carregando transações...</Text>
        </Stack>
      </Center>
    );
  }

  if (isError) {
    return (
      <Center py={8}>
        <Text color="red.600">Erro ao carregar transações</Text>
      </Center>
    );
  }

  if (!data?.transactions || data.transactions.length === 0) {
    return (
      <Center py={8}>
        <Stack spacing={2} align="center">
          <Text color="gray.600">Nenhuma transação encontrada</Text>
          <Text fontSize="sm" color="gray.500">
            Comece criando uma receita ou despesa
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack spacing={3}>
      {/* Summary */}
      <Box bg="gray.50" p={3} borderRadius="lg">
        <Text fontSize="sm" color="gray.600">
          Total: <strong>{data.pagination.total_items}</strong> transações
        </Text>
      </Box>

      {/* Transaction List */}
      <Stack spacing={2} maxH="96" overflowY="auto">
        {data.transactions.map((transaction) => (
          <Box
            key={transaction.id}
            bg="white"
            borderWidth="1px"
            borderColor="gray.200"
            borderRadius="lg"
            p={4}
            _hover={{ shadow: 'md' }}
            transition="all 0.2s"
          >
            <Flex align="flex-start" justify="space-between">
              {/* Left side - Icon and Info */}
              <Flex align="flex-start" gap={3} flex="1">
                <Icon
                  as={getTransactionIcon(transaction.type, transaction.status)}
                  boxSize={5}
                  color={getTransactionColor(transaction.type, transaction.status)}
                  mt={1}
                />
                <Box flex="1" minW="0">
                  <Flex align="center" gap={2} flexWrap="wrap">
                    <Text fontWeight="medium" color="gray.900">
                      {transaction.description}
                    </Text>
                    <Badge colorScheme="gray" fontSize="xs">
                      {getTypeLabel(transaction.type)}
                    </Badge>
                  </Flex>

                  <Stack spacing={1} mt={1}>
                    <Text fontSize="sm" color="gray.600">
                      {transaction.category?.name || 'Sem categoria'}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {formatDate(transaction.due_date)}
                    </Text>
                    {transaction.account && (
                      <Text fontSize="xs" color="gray.500">
                        Conta: {transaction.account.account_name}
                      </Text>
                    )}
                  </Stack>

                  {/* Status Badge using molecule */}
                  <Box mt={2}>
                    <StatusBadge status={transaction.status} />
                  </Box>
                </Box>
              </Flex>

              {/* Right side - Amount and Actions */}
              <Box textAlign="right" ml={4}>
                <Text
                  fontSize="lg"
                  fontWeight="bold"
                  color={getTransactionColor(transaction.type, transaction.status)}
                >
                  {transaction.type === 'income' ? '+' : '-'}{' '}
                  {formatCurrency(Number(transaction.amount))}
                </Text>

                {/* Mark as Paid Button - Only for locked fixed expenses */}
                {transaction.type === 'fixed_expense' && transaction.status === 'locked' && (
                  <Button
                    onClick={() => handleMarkAsPaid(transaction.id)}
                    size="sm"
                    colorScheme="green"
                    leftIcon={<CheckCircle size={12} />}
                    mt={2}
                  >
                    Marcar como Paga
                  </Button>
                )}

                {/* Action Buttons */}
                <Flex gap={2} mt={2} justify="flex-end">
                  <IconButton
                    onClick={() => handleDuplicate(transaction.id, transaction.description)}
                    size="sm"
                    variant="ghost"
                    colorScheme="purple"
                    aria-label="Duplicar"
                    icon={<Copy size={16} />}
                  />
                  <IconButton
                    onClick={() => handleEdit(transaction)}
                    size="sm"
                    variant="ghost"
                    colorScheme="blue"
                    aria-label="Editar"
                    icon={<Pencil size={16} />}
                  />
                  <IconButton
                    onClick={() => handleDelete(transaction.id)}
                    size="sm"
                    variant="ghost"
                    colorScheme="red"
                    aria-label="Excluir"
                    icon={<Trash2 size={16} />}
                  />
                </Flex>
              </Box>
            </Flex>
          </Box>
        ))}
      </Stack>

      {/* Pagination info */}
      {data.pagination.total_pages > 1 && (
        <Center pt={2}>
          <Text fontSize="sm" color="gray.500">
            Página {data.pagination.current_page} de {data.pagination.total_pages}
          </Text>
        </Center>
      )}

      {/* Edit Dialog using Chakra Modal */}
      <Modal isOpen={!!editingTransaction} onClose={() => setEditingTransaction(null)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Editar Transação</ModalHeader>
          <ModalCloseButton />

          <ModalBody pb={6}>
            <form onSubmit={handleUpdate}>
              <Stack spacing={4}>
                <FormField
                  label="Descrição"
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  isRequired
                />

                <FormField
                  label="Valor (R$)"
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })}
                  isRequired
                />

                <FormSelect
                  label="Categoria"
                  value={editForm.categoryId}
                  onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                  isRequired
                >
                  <option value="">Selecione uma categoria</option>
                  {categoriesData?.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </FormSelect>

                {editingTransaction?.type !== 'variable_expense' && (
                  <FormField
                    label="Data de Vencimento"
                    type="date"
                    value={editForm.dueDate}
                    onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                  />
                )}

                <Flex gap={3} justify="flex-end" pt={4}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingTransaction(null)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" isDisabled={updateTransaction.isPending}>
                    {updateTransaction.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </Flex>
              </Stack>
            </form>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Stack>
  );
}
