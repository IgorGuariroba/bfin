import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { useMyInvitations, useAcceptInvitation, useRejectInvitation } from '../../hooks/useAccountMembers';
import { Mail, Check, X, Clock, User } from 'lucide-react';

interface InvitationsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InvitationsDialog({ isOpen, onClose }: InvitationsDialogProps) {
  const { data: invitations = [], isLoading } = useMyInvitations();
  const acceptInvitation = useAcceptInvitation();
  const rejectInvitation = useRejectInvitation();

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      owner: 'Proprietário',
      member: 'Membro',
      viewer: 'Visualizador',
    };
    return labels[role] || role;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const handleAccept = async (token: string, accountName: string) => {
    if (window.confirm(`Deseja aceitar o convite para a conta "${accountName}"?`)) {
      try {
        await acceptInvitation.mutateAsync(token);
        alert('Convite aceito com sucesso!');
      } catch (error: any) {
        alert(error.response?.data?.error || 'Erro ao aceitar convite');
      }
    }
  };

  const handleReject = async (token: string, accountName: string) => {
    if (window.confirm(`Deseja rejeitar o convite para a conta "${accountName}"?`)) {
      try {
        await rejectInvitation.mutateAsync(token);
        alert('Convite rejeitado');
      } catch (error: any) {
        alert(error.response?.data?.error || 'Erro ao rejeitar convite');
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl relative">
        <DialogClose onClose={onClose} />
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              <span>Meus Convites</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Carregando convites...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="p-5 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-lg mb-1">
                        {invitation.account?.account_name || 'Conta'}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="h-4 w-4" />
                        <span>Convidado por {invitation.inviter.full_name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600">Permissão:</span>
                      <span className="font-medium text-gray-900 bg-gray-100 px-3 py-1 rounded-full">
                        {getRoleLabel(invitation.role)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span>Expira em {formatDate(invitation.expires_at)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAccept(invitation.token, invitation.account?.account_name || 'Conta')}
                      disabled={acceptInvitation.isPending || rejectInvitation.isPending}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4" />
                      Aceitar
                    </Button>
                    <Button
                      onClick={() => handleReject(invitation.token, invitation.account?.account_name || 'Conta')}
                      disabled={acceptInvitation.isPending || rejectInvitation.isPending}
                      variant="outline"
                      className="flex items-center gap-2 border-red-300 text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                      Recusar
                    </Button>
                  </div>
                </div>
              ))}

              {invitations.length === 0 && (
                <div className="text-center py-12">
                  <Mail className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">Você não tem convites pendentes</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
