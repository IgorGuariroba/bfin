import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../components/ui/Dialog';
import { IncomeForm } from '../components/transactions/IncomeForm';
import { FixedExpenseForm } from '../components/transactions/FixedExpenseForm';
import { VariableExpenseForm } from '../components/transactions/VariableExpenseForm';
import { CreateAccountForm } from '../components/accounts/CreateAccountForm';
import { useAccounts } from '../hooks/useAccounts';
import { useTotalDailyLimit } from '../hooks/useDailyLimit';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
  const [fixedExpenseDialogOpen, setFixedExpenseDialogOpen] = useState(false);
  const [variableExpenseDialogOpen, setVariableExpenseDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();

  // Buscar limite diário de todas as contas
  const accountIds = accounts?.map((acc) => acc.id) || [];
  const { data: dailyLimit, isLoading: loadingDailyLimit } = useTotalDailyLimit(accountIds);

  function handleSignOut() {
    signOut();
    navigate('/login');
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card Saldo Total */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Saldo Total</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {loadingAccounts ? 'Carregando...' : formatCurrency(totals.totalBalance)}
            </p>
            <p className="mt-1 text-sm text-gray-500">Todas as contas</p>
          </div>

          {/* Card Disponível */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Disponível</h3>
            <p className="mt-2 text-3xl font-bold text-green-600">
              {loadingAccounts ? 'Carregando...' : formatCurrency(totals.availableBalance)}
            </p>
            <p className="mt-1 text-sm text-gray-500">Para gastos</p>
          </div>

          {/* Card Reserva */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">
              Reserva de Emergência
            </h3>
            <p className="mt-2 text-3xl font-bold text-blue-600">
              {loadingAccounts ? 'Carregando...' : formatCurrency(totals.emergencyReserve)}
            </p>
            <p className="mt-1 text-sm text-gray-500">30% das receitas</p>
          </div>
        </div>

        {/* Limite Diário */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Limite Diário Sugerido
          </h2>
          {loadingDailyLimit || loadingAccounts ? (
            <p className="text-gray-500">Carregando...</p>
          ) : !dailyLimit || dailyLimit.totalDailyLimit === 0 ? (
            <p className="text-gray-500">
              Registre uma receita para ver sua sugestão de limite diário
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Gasto hoje</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(dailyLimit.totalSpentToday)} / {formatCurrency(dailyLimit.totalDailyLimit)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      dailyLimit.exceeded ? 'bg-red-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(100, dailyLimit.percentageUsed)}%` }}
                  ></div>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                {dailyLimit.exceeded ? (
                  <>
                    Você <strong className="text-red-600">excedeu</strong> o limite em{' '}
                    <strong className="text-red-600">
                      {formatCurrency(dailyLimit.totalSpentToday - dailyLimit.totalDailyLimit)}
                    </strong>
                  </>
                ) : (
                  <>
                    Você ainda pode gastar{' '}
                    <strong className="text-green-600">
                      {formatCurrency(dailyLimit.totalRemaining)}
                    </strong>{' '}
                    hoje
                  </>
                )}
              </p>
              <div className="text-xs text-gray-400 mt-2">
                Cálculo: Saldo disponível ÷ 30 dias
              </div>
            </div>
          )}
        </div>

        {/* Próximas Despesas */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Próximas Despesas Fixas
          </h2>
          <div className="text-center py-8 text-gray-500">
            Nenhuma despesa agendada
          </div>
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
    </div>
  );
}
