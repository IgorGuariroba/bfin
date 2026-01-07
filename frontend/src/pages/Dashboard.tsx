import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../components/ui/Dialog';
import { IncomeForm } from '../components/transactions/IncomeForm';
import { FixedExpenseForm } from '../components/transactions/FixedExpenseForm';
import { VariableExpenseForm } from '../components/transactions/VariableExpenseForm';
import { CreateAccountForm } from '../components/accounts/CreateAccountForm';
import { AccountsDialog } from '../components/accounts/AccountsDialog';
import { InvitationsDialog } from '../components/invitations/InvitationsDialog';
import { TransactionList } from '../components/transactions/TransactionList';
import { useAccounts } from '../hooks/useAccounts';
import { useTotalDailyLimit } from '../hooks/useDailyLimit';
import { useUpcomingFixedExpenses, useMarkAsPaid } from '../hooks/useTransactions';
import { useMyInvitations } from '../hooks/useAccountMembers';
import { Shield, TrendingUp, Calendar, ShoppingCart, Wallet, Mail } from 'lucide-react';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
  const [fixedExpenseDialogOpen, setFixedExpenseDialogOpen] = useState(false);
  const [variableExpenseDialogOpen, setVariableExpenseDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [manageAccountsDialogOpen, setManageAccountsDialogOpen] = useState(false);
  const [transactionsDialogOpen, setTransactionsDialogOpen] = useState(false);
  const [emergencyReserveDialogOpen, setEmergencyReserveDialogOpen] = useState(false);
  const [invitationsDialogOpen, setInvitationsDialogOpen] = useState(false);
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const { data: invitations = [] } = useMyInvitations();

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
              <Button
                variant="outline"
                onClick={() => setInvitationsDialogOpen(true)}
                className="flex items-center gap-2 relative"
              >
                <Mail className="h-4 w-4" />
                Convites
                {invitations.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {invitations.length}
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setManageAccountsDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <Wallet className="h-4 w-4" />
                Gerenciar Contas
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alerta Limite Diário - Compacto no lado direito */}
        {!loadingDailyLimit && !loadingAccounts && dailyLimit && dailyLimit.totalDailyLimit > 0 && (
          <div className="mb-6 flex justify-end">
            <div
              className={`rounded-lg p-4 border w-full md:w-2/5 ${
                dailyLimit.exceeded
                  ? 'bg-red-50 border-red-200'
                  : dailyLimit.percentageUsed > 80
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="space-y-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    Limite Diário Sugerido
                  </h3>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Gasto hoje</span>
                    <span className="font-medium">
                      {formatCurrency(dailyLimit.totalSpentToday)} / {formatCurrency(dailyLimit.totalDailyLimit)}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
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
                <p className="text-xs">
                  {dailyLimit.exceeded ? (
                    <span className="text-red-700 font-medium">
                      Excedido em {formatCurrency(dailyLimit.totalSpentToday - dailyLimit.totalDailyLimit)}
                    </span>
                  ) : (
                    <span className={dailyLimit.percentageUsed > 80 ? 'text-yellow-700' : 'text-green-700'}>
                      Restam {formatCurrency(dailyLimit.totalRemaining)} hoje
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Ações Rápidas */}
        {!loadingAccounts && accounts && accounts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Botão Nova Receita */}
            <button
              onClick={() => setIncomeDialogOpen(true)}
              className="bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg p-6 shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white/20 p-3 rounded-full">
                  <TrendingUp className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold">Nova Receita</h3>
                  <p className="text-sm text-green-100 mt-1">Registrar entrada</p>
                </div>
              </div>
            </button>

            {/* Botão Despesa Fixa */}
            <button
              onClick={() => setFixedExpenseDialogOpen(true)}
              className="bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg p-6 shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white/20 p-3 rounded-full">
                  <Calendar className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold">Despesa Fixa</h3>
                  <p className="text-sm text-orange-100 mt-1">Conta recorrente</p>
                </div>
              </div>
            </button>

            {/* Botão Despesa Variável */}
            <button
              onClick={() => setVariableExpenseDialogOpen(true)}
              className="bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg p-6 shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white/20 p-3 rounded-full">
                  <ShoppingCart className="h-8 w-8" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold">Despesa Variável</h3>
                  <p className="text-sm text-red-100 mt-1">Gasto do dia</p>
                </div>
              </div>
            </button>
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

        {/* Mensagem para criar conta se não houver */}
        {!loadingAccounts && (!accounts || accounts.length === 0) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Bem-vindo ao BFIN!
            </h3>
            <p className="text-blue-700 mb-4">
              Para começar, você precisa criar uma conta bancária.
            </p>
            <Button onClick={() => setAccountDialogOpen(true)}>+ Criar Conta</Button>
          </div>
        )}
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

      {/* Manage Accounts Dialog */}
      <AccountsDialog
        isOpen={manageAccountsDialogOpen}
        onClose={() => setManageAccountsDialogOpen(false)}
      />

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
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <span>Reserva de Emergência</span>
              </div>
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

      {/* Invitations Dialog */}
      <InvitationsDialog
        isOpen={invitationsDialogOpen}
        onClose={() => setInvitationsDialogOpen(false)}
      />
    </div>
  );
}
