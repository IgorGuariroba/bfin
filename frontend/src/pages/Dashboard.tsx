import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../components/ui/Dialog';
import { IncomeForm } from '../components/transactions/IncomeForm';
import { CreateAccountForm } from '../components/accounts/CreateAccountForm';
import { useAccounts } from '../hooks/useAccounts';

export function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();

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
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Gasto hoje</span>
                <span className="text-sm font-medium">R$ 0,00 / R$ 0,00</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: '0%' }}
                ></div>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Você ainda pode gastar <strong>R$ 0,00</strong> hoje
            </p>
          </div>
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
                Registre sua primeira receita para começar a gerenciar suas finanças
                automaticamente.
              </p>
              <div className="flex gap-4">
                <Button onClick={() => setIncomeDialogOpen(true)}>+ Nova Receita</Button>
                <Button variant="outline">+ Nova Despesa</Button>
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
