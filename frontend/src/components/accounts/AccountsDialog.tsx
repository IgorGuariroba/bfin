import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../ui/Dialog';
import { useAccounts } from '../../hooks/useAccounts';
import { AccountMembersDialog } from './AccountMembersDialog';
import { Wallet, Users, UserPlus } from 'lucide-react';

interface AccountsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountsDialog({ isOpen, onClose }: AccountsDialogProps) {
  const { data: accounts, isLoading } = useAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedAccountName, setSelectedAccountName] = useState<string>('');
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleManageMembers = (accountId: string, accountName: string) => {
    setSelectedAccountId(accountId);
    setSelectedAccountName(accountName);
    setMembersDialogOpen(true);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl relative">
          <DialogClose onClose={onClose} />
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                <span>Minhas Contas</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Carregando contas...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {accounts?.map((account) => (
                  <div
                    key={account.id}
                    className="p-5 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    {/* Header with badges */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg mb-2">
                          {account.account_name}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          {account.is_default && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              Padrão
                            </span>
                          )}
                          {account.is_shared && (
                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              Compartilhada
                            </span>
                          )}
                          {account.user_role === 'owner' && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                              Proprietário
                            </span>
                          )}
                          {account.user_role === 'member' && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                              Membro
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleManageMembers(account.id, account.account_name)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm whitespace-nowrap ml-4"
                      >
                        <UserPlus className="h-4 w-4" />
                        Membros
                      </button>
                    </div>

                    {/* Balances flex layout */}
                    <div className="flex flex-wrap gap-3">
                      <div className="bg-green-50 px-4 py-3 rounded-lg flex-1 min-w-[140px]">
                        <p className="text-xs text-gray-600 mb-1.5 whitespace-nowrap">Disponível</p>
                        <p className="font-semibold text-green-700 whitespace-nowrap">
                          {formatCurrency(Number(account.available_balance))}
                        </p>
                      </div>
                      <div className="bg-blue-50 px-4 py-3 rounded-lg flex-1 min-w-[140px]">
                        <p className="text-xs text-gray-600 mb-1.5 whitespace-nowrap">Bloqueado</p>
                        <p className="font-semibold text-blue-700 whitespace-nowrap">
                          {formatCurrency(Number(account.locked_balance))}
                        </p>
                      </div>
                      <div className="bg-yellow-50 px-4 py-3 rounded-lg flex-1 min-w-[140px]">
                        <p className="text-xs text-gray-600 mb-1.5 whitespace-nowrap">Reserva</p>
                        <p className="font-semibold text-yellow-700 whitespace-nowrap">
                          {formatCurrency(Number(account.emergency_reserve))}
                        </p>
                      </div>
                      <div className="bg-gray-50 px-4 py-3 rounded-lg flex-1 min-w-[140px]">
                        <p className="text-xs text-gray-600 mb-1.5 whitespace-nowrap">Total</p>
                        <p className="font-semibold text-gray-900 whitespace-nowrap">
                          {formatCurrency(Number(account.total_balance))}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {accounts?.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    Nenhuma conta encontrada
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      {selectedAccountId && (
        <AccountMembersDialog
          isOpen={membersDialogOpen}
          onClose={() => setMembersDialogOpen(false)}
          accountId={selectedAccountId}
          accountName={selectedAccountName}
        />
      )}
    </>
  );
}
