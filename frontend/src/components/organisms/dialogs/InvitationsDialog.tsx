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
} from '@chakra-ui/react';
import { Mail, Check, X, Clock, User } from 'lucide-react';
import { Button } from '../../atoms/Button';
import { useMyInvitations, useAcceptInvitation, useRejectInvitation } from '../../../hooks/useAccountMembers';

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
    <Modal isOpen={isOpen} onClose={onClose} size="3xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Flex align="center" gap={2}>
            <Icon as={Mail} />
            <Text>Meus Convites</Text>
          </Flex>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody pb={6}>
          {isLoading ? (
            <Center py={8}>
              <Stack spacing={2} align="center">
                <Spinner size="lg" color="brand.600" />
                <Text color="gray.600">Carregando convites...</Text>
              </Stack>
            </Center>
          ) : (
            <Stack spacing={3}>
              {invitations.map((invitation) => (
                <Box
                  key={invitation.id}
                  p={5}
                  bg="white"
                  borderWidth="1px"
                  borderColor="gray.200"
                  borderRadius="lg"
                  _hover={{ shadow: 'md' }}
                  transition="all 0.2s"
                >
                  {/* Header */}
                  <Flex justify="space-between" align="flex-start" mb={4}>
                    <Box flex="1">
                      <Text fontSize="lg" fontWeight="semibold" color="gray.900" mb={1}>
                        {invitation.account?.account_name || 'Conta'}
                      </Text>
                      <Flex align="center" gap={2} fontSize="sm" color="gray.600">
                        <Icon as={User} boxSize={4} />
                        <Text>Convidado por {invitation.inviter.full_name}</Text>
                      </Flex>
                    </Box>
                  </Flex>

                  {/* Details */}
                  <Flex align="center" gap={4} mb={4} flexWrap="wrap">
                    <Flex align="center" gap={2} fontSize="sm">
                      <Text color="gray.600">Permissão:</Text>
                      <Badge colorScheme="gray" px={3} py={1}>
                        {getRoleLabel(invitation.role)}
                      </Badge>
                    </Flex>
                    <Flex align="center" gap={2} fontSize="sm" color="gray.600">
                      <Icon as={Clock} boxSize={4} />
                      <Text>Expira em {formatDate(invitation.expires_at)}</Text>
                    </Flex>
                  </Flex>

                  {/* Actions */}
                  <Flex gap={2}>
                    <Button
                      onClick={() => handleAccept(invitation.token, invitation.account?.account_name || 'Conta')}
                      isDisabled={acceptInvitation.isPending || rejectInvitation.isPending}
                      colorScheme="green"
                      leftIcon={<Check size={16} />}
                    >
                      Aceitar
                    </Button>
                    <Button
                      onClick={() => handleReject(invitation.token, invitation.account?.account_name || 'Conta')}
                      isDisabled={acceptInvitation.isPending || rejectInvitation.isPending}
                      variant="outline"
                      colorScheme="red"
                      leftIcon={<X size={16} />}
                    >
                      Recusar
                    </Button>
                  </Flex>
                </Box>
              ))}

              {invitations.length === 0 && (
                <Center py={12}>
                  <Stack spacing={3} align="center">
                    <Icon as={Mail} boxSize={12} color="gray.400" />
                    <Text color="gray.500">Você não tem convites pendentes</Text>
                  </Stack>
                </Center>
              )}
            </Stack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
