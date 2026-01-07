import { useState } from 'react';
import { useTransactions, useDeleteTransaction, useUpdateTransaction } from '../../hooks/useTransactions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowUpCircle, ArrowDownCircle, Lock, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../ui/Dialog';
import { useCategories } from '../../hooks/useCategories';

interface TransactionListProps {
  accountId?: string;
}

export function TransactionList({ accountId }: TransactionListProps) {
  const { data, isLoading, isError } = useTransactions({ accountId });
  const deleteTransaction = useDeleteTransaction();
  const updateTransaction = useUpdateTransaction();
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
      return <Lock className="h-5 w-5 text-blue-500" />;
    }
    if (type === 'income') {
      return <ArrowUpCircle className="h-5 w-5 text-green-500" />;
    }
    return <ArrowDownCircle className="h-5 w-5 text-red-500" />;
  };

  const getTransactionColor = (type: string, status: string) => {
    if (status === 'locked') return 'text-blue-600';
    if (type === 'income') return 'text-green-600';
    return 'text-red-600';
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'Pendente',
      executed: 'Executado',
      cancelled: 'Cancelado',
      locked: 'Bloqueado',
    };
    return statusMap[status] || status;
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

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Carregando transações...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Erro ao carregar transações</p>
      </div>
    );
  }

  if (!data?.transactions || data.transactions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Nenhuma transação encontrada</p>
        <p className="text-sm text-gray-500 mt-2">
          Comece criando uma receita ou despesa
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="bg-gray-50 p-3 rounded-lg">
        <p className="text-sm text-gray-600">
          Total: <strong>{data.pagination.total_items}</strong> transações
        </p>
      </div>

      {/* Transaction List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {data.transactions.map((transaction) => (
          <div
            key={transaction.id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              {/* Left side - Icon and Info */}
              <div className="flex items-start gap-3 flex-1">
                <div className="mt-1">
                  {getTransactionIcon(transaction.type, transaction.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-gray-900">
                      {transaction.description}
                    </h4>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {getTypeLabel(transaction.type)}
                    </span>
                  </div>

                  <div className="mt-1 space-y-1">
                    <p className="text-sm text-gray-600">
                      {transaction.category?.name || 'Sem categoria'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(transaction.due_date)}
                    </p>
                    {transaction.account && (
                      <p className="text-xs text-gray-500">
                        Conta: {transaction.account.account_name}
                      </p>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="mt-2">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        transaction.status === 'executed'
                          ? 'bg-green-100 text-green-800'
                          : transaction.status === 'locked'
                          ? 'bg-blue-100 text-blue-800'
                          : transaction.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {getStatusLabel(transaction.status)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right side - Amount and Actions */}
              <div className="text-right ml-4">
                <p
                  className={`text-lg font-bold ${getTransactionColor(
                    transaction.type,
                    transaction.status
                  )}`}
                >
                  {transaction.type === 'income' ? '+' : '-'}{' '}
                  {formatCurrency(Number(transaction.amount))}
                </p>

                {/* Action Buttons - Available for all transactions */}
                <div className="flex gap-2 mt-2 justify-end">
                  <button
                    onClick={() => handleEdit(transaction)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(transaction.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination info */}
      {data.pagination.total_pages > 1 && (
        <div className="text-center text-sm text-gray-500 pt-2">
          Página {data.pagination.current_page} de {data.pagination.total_pages}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingTransaction} onOpenChange={() => setEditingTransaction(null)}>
        <DialogContent className="relative">
          <DialogClose onClose={() => setEditingTransaction(null)} />
          <DialogHeader>
            <DialogTitle>Editar Transação</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <input
                type="text"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria
              </label>
              <select
                value={editForm.categoryId}
                onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Selecione uma categoria</option>
                {categoriesData?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {editingTransaction?.type !== 'variable_expense' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Vencimento
                </label>
                <input
                  type="date"
                  value={editForm.dueDate}
                  onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingTransaction(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={updateTransaction.isPending}>
                {updateTransaction.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
