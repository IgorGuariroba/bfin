import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { useAccountMembers, useAddAccountMember, useRemoveAccountMember, useUpdateMemberRole, useAccountInvitations } from '../../hooks/useAccountMembers';
import { Users, UserPlus, Trash2, Crown, Eye, User as UserIcon, Mail, Clock } from 'lucide-react';

interface AccountMembersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  accountName: string;
}

export function AccountMembersDialog({ isOpen, onClose, accountId, accountName }: AccountMembersDialogProps) {
  const { data: membersData, isLoading } = useAccountMembers(accountId);
  const { data: invitations = [], isLoading: isLoadingInvitations } = useAccountInvitations(accountId);
  const addMember = useAddAccountMember();
  const removeMember = useRemoveAccountMember();
  const updateRole = useUpdateMemberRole();

  const [showAddForm, setShowAddForm] = useState(false);
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<'owner' | 'member' | 'viewer'>('member');

  const members = membersData?.members || [];
  const originalOwnerId = membersData?.original_owner_id;
  const pendingInvitations = invitations.filter((inv) => inv.status === 'pending');

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-600" />;
      case 'member':
        return <UserIcon className="h-4 w-4 text-blue-600" />;
      case 'viewer':
        return <Eye className="h-4 w-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      owner: 'Proprietário',
      member: 'Membro',
      viewer: 'Visualizador',
    };
    return labels[role] || role;
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      alert('Digite um email válido');
      return;
    }

    try {
      await addMember.mutateAsync({
        accountId,
        data: {
          email: email.trim(),
          role: selectedRole,
        },
      });

      setEmail('');
      setSelectedRole('member');
      setShowAddForm(false);
      alert('Convite enviado com sucesso!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao enviar convite');
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (window.confirm(`Deseja remover ${userName} desta conta?`)) {
      try {
        await removeMember.mutateAsync({ accountId, userId });
      } catch (error: any) {
        alert(error.response?.data?.error || 'Erro ao remover membro');
      }
    }
  };

  const handleChangeRole = async (userId: string, userName: string, currentRole: string) => {
    const newRole = window.prompt(
      `Alterar permissão de ${userName}\n\nRoles disponíveis:\n- owner (Proprietário)\n- member (Membro)\n- viewer (Visualizador)\n\nRole atual: ${currentRole}\n\nDigite o novo role:`
    );

    if (newRole && ['owner', 'member', 'viewer'].includes(newRole)) {
      try {
        await updateRole.mutateAsync({
          accountId,
          userId,
          role: newRole as 'owner' | 'member' | 'viewer',
        });
      } catch (error: any) {
        alert(error.response?.data?.error || 'Erro ao atualizar permissão');
      }
    } else if (newRole) {
      alert('Role inválido. Use: owner, member ou viewer');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl relative">
        <DialogClose onClose={onClose} />
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span>Membros da Conta - {accountName}</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {/* Add Member Button */}
          {!showAddForm && (
            <Button
              onClick={() => setShowAddForm(true)}
              className="mb-4 flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Adicionar Membro
            </Button>
          )}

          {/* Add Member Form */}
          {showAddForm && (
            <form onSubmit={handleAddMember} className="mb-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Convidar Membro</h4>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email do usuário
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Permissão
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as 'owner' | 'member' | 'viewer')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="viewer">Visualizador - Apenas visualiza</option>
                    <option value="member">Membro - Pode criar transações</option>
                    <option value="owner">Proprietário - Controle total</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button type="submit" disabled={addMember.isPending}>
                  {addMember.isPending ? 'Adicionando...' : 'Adicionar'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setEmail('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          {/* Members List */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Carregando membros...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {members?.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    {getRoleIcon(member.role)}
                    <div>
                      <p className="font-medium text-gray-900">{member.user.full_name}</p>
                      <p className="text-sm text-gray-600">{member.user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                      {getRoleLabel(member.role)}
                    </span>

                    {/* Only show actions for non-original-owners */}
                    {member.user_id !== originalOwnerId && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleChangeRole(member.user_id, member.user.full_name, member.role)}
                          className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                          title="Alterar permissão"
                        >
                          Alterar
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.user_id, member.user.full_name)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Remover membro"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {members.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  Nenhum membro adicionado ainda
                </p>
              )}
            </div>
          )}

          {/* Pending Invitations Section */}
          {!isLoading && !isLoadingInvitations && pendingInvitations.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Convites Pendentes
              </h3>
              <div className="space-y-2">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <div>
                        <p className="font-medium text-gray-900">{invitation.invited_email}</p>
                        <p className="text-xs text-gray-600">
                          Convidado por {invitation.inviter.full_name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full">
                        {getRoleLabel(invitation.role)}
                      </span>
                      <span className="text-xs text-yellow-700">
                        Aguardando
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
