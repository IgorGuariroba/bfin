import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../components/ui/Dialog';
import { IncomeForm } from '../components/transactions/IncomeForm';
import { FixedExpenseForm } from '../components/transactions/FixedExpenseForm';
import { VariableExpenseForm } from '../components/transactions/VariableExpenseForm';
import { CreateAccountForm } from '../components/accounts/CreateAccountForm';
import { TransactionList } from '../components/transactions/TransactionList';
import { useAccounts } from '../hooks/useAccounts';
import { useTotalDailyLimit } from '../hooks/useDailyLimit';
import { useUpcomingFixedExpenses, useMarkAsPaid } from '../hooks/useTransactions';
import { Shield } from 'lucide-react';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
  const [fixedExpenseDialogOpen, setFixedExpenseDialogOpen] = useState(false);
  const [variableExpenseDialogOpen, setVariableExpenseDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [transactionsDialogOpen, setTransactionsDialogOpen] = useState(false);
  const [emergencyReserveDialogOpen, setEmergencyReserveDialogOpen] = useState(false);
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();

  // Buscar limite diário de todas as contas
  const accountIds = accounts?.map((acc) => acc.id) || [];
  const { data: dailyLimit, isLoading: loadingDailyLimit } = useTotalDailyLimit(accountIds);

  // Buscar próximas despesas fixas
  const { data: upcomingExpenses, isLoading: loadingUpcomingExpenses } = useUpcomingFixedExpenses();
  const markAsPaid = useMarkAsPaid();

  function handleSignOut() {
    signOut();
    navigate('/login');
  }

  async function handleMarkAsPaid(id: string, description: string) {
    if (window.confirm(`Deseja marcar "${description}" como paga?`)) {
      try {
        await markAsPaid.mutateAsync(id);
      } catch (error: any) {
        alert(error.response?.data?.error || 'Erro ao marcar como paga');
      }
    }
  }

  // Calculate totals from accounts
  const totals = accounts?.reduce(
    (acc, account) => ({
      totalBalance: acc.totalBalance + Number(account.total_balance),
      availableBalance: acc.availableBalance + Number(account.available_balance),
      lockedBalance: acc.lockedBalance + Number(account.locked_balance),
      emergencyReserve: acc.emergencyReserve + Number(account.emergency_reserve),
    }),
    { totalBalance: 0, availableBalance: 0, lockedBalance: 0, emergencyReserve: 0 }
  ) || { totalBalance: 0, availableBalance: 0, lockedBalance: 0, emergencyReserve: 0 };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-blue-600">BFIN</h1>
              <span className="ml-4 text-gray-600">Dashboard</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-700">Olá, {user?.full_name}</span>
              <Button variant="outline" onClick={handleSignOut}>
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alerta Limite Diário */}
        {!loadingDailyLimit && !loadingAccounts && dailyLimit && dailyLimit.totalDailyLimit > 0 && (
          <div
            className={`rounded-lg p-4 mb-6 border ${
              dailyLimit.exceeded
                ? 'bg-red-50 border-red-200'
                : dailyLimit.percentageUsed > 80
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-blue-50 border-blue-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Limite Diário Sugerido
                  </h3>
                  <span className="text-xs text-gray-500">
                    ({formatCurrency(dailyLimit.totalSpentToday)} / {formatCurrency(dailyLimit.totalDailyLimit)})
                  </span>
                </div>
                <p className="text-sm">
                  {dailyLimit.exceeded ? (
                    <>
                      <span className="text-red-700 font-medium">
                        Limite excedido em {formatCurrency(dailyLimit.totalSpentToday - dailyLimit.totalDailyLimit)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={dailyLimit.percentageUsed > 80 ? 'text-yellow-700' : 'text-green-700'}>
                        Você ainda pode gastar {formatCurrency(dailyLimit.totalRemaining)} hoje
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="ml-4">
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      dailyLimit.exceeded
                        ? 'bg-red-500'
                        : dailyLimit.percentageUsed > 80
                        ? 'bg-yellow-500'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(100, dailyLimit.percentageUsed)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Card Disponível */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">Saldo Disponível</h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEmergencyReserveDialogOpen(true);
              }}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="Ver Reserva de Emergência"
            >
              <Shield className="h-5 w-5" />
            </button>
          </div>
          <div
            className="cursor-pointer"
            onClick={() => setTransactionsDialogOpen(true)}
          >
            <p className="mt-2 text-4xl font-bold text-green-600">
              {loadingAccounts ? 'Carregando...' : formatCurrency(totals.availableBalance)}
            </p>
            <p className="mt-1 text-sm text-gray-500">Para gastos · Clique para ver todas as transações</p>
          </div>
        </div>

        {/* Próximas Despesas */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Próximas Despesas Fixas
          </h2>
          {loadingUpcomingExpenses ? (
            <p className="text-gray-500">Carregando...</p>
          ) : !upcomingExpenses?.transactions || upcomingExpenses.transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma despesa agendada
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingExpenses.transactions.map((expense) => {
                const dueDate = new Date(expense.due_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                dueDate.setHours(0, 0, 0, 0);
                const isOverdue = dueDate < today;

                return (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{expense.description}</p>
                      {expense.category && (
                        <p className="text-sm text-gray-500 mt-1">{expense.category.name}</p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-bold text-red-600">{formatCurrency(expense.amount)}</p>
                      <p className={`text-sm mt-1 ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                        {isOverdue ? 'Vencida: ' : 'Vencimento: '}
                        {new Date(expense.due_date).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => handleMarkAsPaid(expense.id, expense.description)}
                        className="mt-2 text-xs py-1 px-2 bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
                      >
                        Marcar como Paga
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Call to Action */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Comece a usar o BFIN!
          </h3>
          {loadingAccounts ? (
            <p className="text-blue-700">Carregando...</p>
          ) : !accounts || accounts.length === 0 ? (
            <>
              <p className="text-blue-700 mb-4">
                Você precisa criar uma conta bancária antes de registrar transações.
              </p>
              <Button onClick={() => setAccountDialogOpen(true)}>+ Criar Conta</Button>
            </>
          ) : (
            <>
              <p className="text-blue-700 mb-4">
                Registre suas receitas e despesas para gerenciar suas finanças
                automaticamente.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setIncomeDialogOpen(true)}>+ Nova Receita</Button>
                <Button variant="outline" onClick={() => setFixedExpenseDialogOpen(true)}>
                  + Despesa Fixa
                </Button>
                <Button variant="outline" onClick={() => setVariableExpenseDialogOpen(true)}>
                  + Despesa Variável
                </Button>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Income Dialog */}
      <Dialog open={incomeDialogOpen} onOpenChange={setIncomeDialogOpen}>
        <DialogContent className="relative">
          <DialogClose onClose={() => setIncomeDialogOpen(false)} />
          <DialogHeader>
            <DialogTitle>Nova Receita</DialogTitle>
          </DialogHeader>
          <IncomeForm
            onSuccess={() => {
              setIncomeDialogOpen(false);
            }}
            onCancel={() => setIncomeDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Fixed Expense Dialog */}
      <Dialog open={fixedExpenseDialogOpen} onOpenChange={setFixedExpenseDialogOpen}>
        <DialogContent className="relative">
          <DialogClose onClose={() => setFixedExpenseDialogOpen(false)} />
          <DialogHeader>
            <DialogTitle>Nova Despesa Fixa</DialogTitle>
          </DialogHeader>
          <FixedExpenseForm
            onSuccess={() => {
              setFixedExpenseDialogOpen(false);
            }}
            onCancel={() => setFixedExpenseDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Variable Expense Dialog */}
      <Dialog open={variableExpenseDialogOpen} onOpenChange={setVariableExpenseDialogOpen}>
        <DialogContent className="relative">
          <DialogClose onClose={() => setVariableExpenseDialogOpen(false)} />
          <DialogHeader>
            <DialogTitle>Nova Despesa Variável</DialogTitle>
          </DialogHeader>
          <VariableExpenseForm
            onSuccess={() => {
              setVariableExpenseDialogOpen(false);
            }}
            onCancel={() => setVariableExpenseDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Create Account Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="relative">
          <DialogClose onClose={() => setAccountDialogOpen(false)} />
          <DialogHeader>
            <DialogTitle>Criar Conta Bancária</DialogTitle>
          </DialogHeader>
          <CreateAccountForm
            onSuccess={() => {
              setAccountDialogOpen(false);
            }}
            onCancel={() => setAccountDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Transactions Dialog */}
      <Dialog open={transactionsDialogOpen} onOpenChange={setTransactionsDialogOpen}>
        <DialogContent className="relative max-w-4xl">
          <DialogClose onClose={() => setTransactionsDialogOpen(false)} />
          <DialogHeader>
            <DialogTitle>Todas as Transações</DialogTitle>
          </DialogHeader>
          <TransactionList />
        </DialogContent>
      </Dialog>

      {/* Emergency Reserve Dialog */}
      <Dialog open={emergencyReserveDialogOpen} onOpenChange={setEmergencyReserveDialogOpen}>
        <DialogContent className="relative">
          <DialogClose onClose={() => setEmergencyReserveDialogOpen(false)} />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Reserva de Emergência
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 mb-2">
                Sua reserva de emergência é calculada automaticamente como 30% de todas as receitas recebidas.
              </p>
              <p className="text-3xl font-bold text-blue-600">
                {loadingAccounts ? 'Carregando...' : formatCurrency(totals.emergencyReserve)}
              </p>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              <h4 className="font-semibold text-gray-900">Para que serve?</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Proteção financeira para imprevistos</li>
                <li>Cobertura para emergências médicas</li>
                <li>Segurança em caso de perda de renda</li>
                <li>Reparos urgentes em casa ou veículo</li>
              </ul>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500">
              <p className="font-medium text-gray-700 mb-1">Como funciona:</p>
              <p>A cada receita recebida, 30% é automaticamente separado para sua reserva de emergência.
              Os 70% restantes ficam disponíveis para seus gastos do dia a dia.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
