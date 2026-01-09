import { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Box,
  Flex,
  Text,
  Badge,
  Stack,
  Spinner,
  Center,
  Icon,
  IconButton,
} from '@chakra-ui/react';
import { Users, UserPlus, Trash2, Crown, Eye, User as UserIcon, Mail, Clock } from 'lucide-react';
import { Button } from '../../atoms/Button';
import { FormField } from '../../molecules/FormField';
import { FormSelect } from '../../molecules/FormSelect';
import { RoleDisplay } from '../../molecules/RoleDisplay';
import { useAccountMembers, useAddAccountMember, useRemoveAccountMember, useUpdateMemberRole, useAccountInvitations } from '../../../hooks/useAccountMembers';

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
        return Crown;
      case 'member':
        return UserIcon;
      case 'viewer':
        return Eye;
      default:
        return UserIcon;
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
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Flex align="center" gap={2}>
            <Icon as={Users} />
            <Text>Membros da Conta - {accountName}</Text>
          </Flex>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody pb={6}>
          {/* Add Member Button */}
          {!showAddForm && (
            <Button
              onClick={() => setShowAddForm(true)}
              leftIcon={<UserPlus size={16} />}
              mb={4}
            >
              Adicionar Membro
            </Button>
          )}

          {/* Add Member Form */}
          {showAddForm && (
            <Box as="form" onSubmit={handleAddMember} mb={4} p={4} bg="gray.50" borderRadius="lg">
              <Text fontWeight="medium" color="gray.900" mb={3}>Convidar Membro</Text>

              <Stack spacing={3}>
                <FormField
                  label="Email do usuário"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  isRequired
                />

                <FormSelect
                  label="Permissão"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as 'owner' | 'member' | 'viewer')}
                >
                  <option value="viewer">Visualizador - Apenas visualiza</option>
                  <option value="member">Membro - Pode criar transações</option>
                  <option value="owner">Proprietário - Controle total</option>
                </FormSelect>
              </Stack>

              <Flex gap={2} mt={4}>
                <Button type="submit" isDisabled={addMember.isPending}>
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
              </Flex>
            </Box>
          )}

          {/* Members List */}
          {isLoading ? (
            <Center py={8}>
              <Stack spacing={2} align="center">
                <Spinner size="lg" color="brand.600" />
                <Text color="gray.600">Carregando membros...</Text>
              </Stack>
            </Center>
          ) : (
            <Stack spacing={2}>
              {members?.map((member) => (
                <Flex
                  key={member.id}
                  align="center"
                  justify="space-between"
                  p={4}
                  bg="white"
                  borderWidth="1px"
                  borderColor="gray.200"
                  borderRadius="lg"
                  _hover={{ shadow: 'md' }}
                  transition="all 0.2s"
                >
                  <Flex align="center" gap={3}>
                    <Icon as={getRoleIcon(member.role)} boxSize={4} color={`${member.role === 'owner' ? 'yellow' : member.role === 'member' ? 'blue' : 'gray'}.600`} />
                    <Box>
                      <Text fontWeight="medium" color="gray.900">{member.user.full_name}</Text>
                      <Text fontSize="sm" color="gray.600">{member.user.email}</Text>
                    </Box>
                  </Flex>

                  <Flex align="center" gap={3}>
                    <RoleDisplay role={member.role} />

                    {/* Only show actions for non-original-owners */}
                    {member.user_id !== originalOwnerId && (
                      <Flex gap={2}>
                        <Button
                          onClick={() => handleChangeRole(member.user_id, member.user.full_name, member.role)}
                          size="sm"
                          variant="ghost"
                          colorScheme="blue"
                        >
                          Alterar
                        </Button>
                        <IconButton
                          onClick={() => handleRemoveMember(member.user_id, member.user.full_name)}
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          aria-label="Remover membro"
                          icon={<Trash2 size={16} />}
                        />
                      </Flex>
                    )}
                  </Flex>
                </Flex>
              ))}

              {members.length === 0 && (
                <Center py={8}>
                  <Text color="gray.500">Nenhum membro adicionado ainda</Text>
                </Center>
              )}
            </Stack>
          )}

          {/* Pending Invitations Section */}
          {!isLoading && !isLoadingInvitations && pendingInvitations.length > 0 && (
            <Box mt={6}>
              <Text fontSize="sm" fontWeight="semibold" color="gray.700" mb={3}>
                <Flex align="center" gap={2}>
                  <Icon as={Mail} boxSize={4} />
                  <span>Convites Pendentes</span>
                </Flex>
              </Text>
              <Stack spacing={2}>
                {pendingInvitations.map((invitation) => (
                  <Flex
                    key={invitation.id}
                    align="center"
                    justify="space-between"
                    p={4}
                    bg="yellow.50"
                    borderWidth="1px"
                    borderColor="yellow.200"
                    borderRadius="lg"
                  >
                    <Flex align="center" gap={3}>
                      <Icon as={Clock} boxSize={4} color="yellow.600" />
                      <Box>
                        <Text fontWeight="medium" color="gray.900">{invitation.invited_email}</Text>
                        <Text fontSize="xs" color="gray.600">
                          Convidado por {invitation.inviter.full_name}
                        </Text>
                      </Box>
                    </Flex>

                    <Flex align="center" gap={3}>
                      <Badge colorScheme="gray" px={3} py={1}>
                        {getRoleLabel(invitation.role)}
                      </Badge>
                      <Text fontSize="xs" color="yellow.700">
                        Aguardando
                      </Text>
                    </Flex>
                  </Flex>
                ))}
              </Stack>
            </Box>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
