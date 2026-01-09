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
  SimpleGrid,
} from '@chakra-ui/react';
import { Wallet, Users, UserPlus } from 'lucide-react';
import { Button } from '../../atoms/Button';
import { BalanceCard } from '../../molecules/BalanceCard';
import { useAccounts } from '../../../hooks/useAccounts';
import { AccountMembersDialog } from './AccountMembersDialog';

interface AccountsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountsDialog({ isOpen, onClose }: AccountsDialogProps) {
  const { data: accounts, isLoading } = useAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedAccountName, setSelectedAccountName] = useState<string>('');
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);

  const handleManageMembers = (accountId: string, accountName: string) => {
    setSelectedAccountId(accountId);
    setSelectedAccountName(accountName);
    setMembersDialogOpen(true);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <Flex align="center" gap={2}>
              <Icon as={Wallet} />
              <Text>Minhas Contas</Text>
            </Flex>
          </ModalHeader>
          <ModalCloseButton />

          <ModalBody pb={6}>
            {isLoading ? (
              <Center py={8}>
                <Stack spacing={2} align="center">
                  <Spinner size="lg" color="brand.600" />
                  <Text color="gray.600">Carregando contas...</Text>
                </Stack>
              </Center>
            ) : (
              <Stack spacing={4}>
                {accounts?.map((account) => (
                  <Box
                    key={account.id}
                    p={5}
                    bg="white"
                    borderWidth="1px"
                    borderColor="gray.200"
                    borderRadius="lg"
                    _hover={{ shadow: 'md' }}
                    transition="all 0.2s"
                  >
                    {/* Header with badges */}
                    <Flex justify="space-between" align="flex-start" mb={4}>
                      <Box flex="1">
                        <Text fontSize="lg" fontWeight="semibold" color="gray.900" mb={2}>
                          {account.account_name}
                        </Text>
                        <Flex gap={2} flexWrap="wrap">
                          {account.is_default && (
                            <Badge colorScheme="blue" fontSize="xs" px={2} py={1}>
                              Padrão
                            </Badge>
                          )}
                          {account.is_shared && (
                            <Badge colorScheme="purple" fontSize="xs" px={2} py={1}>
                              <Flex align="center" gap={1}>
                                <Icon as={Users} boxSize={3} />
                                <span>Compartilhada</span>
                              </Flex>
                            </Badge>
                          )}
                          {account.user_role === 'owner' && (
                            <Badge colorScheme="yellow" fontSize="xs" px={2} py={1}>
                              Proprietário
                            </Badge>
                          )}
                          {account.user_role === 'member' && (
                            <Badge colorScheme="green" fontSize="xs" px={2} py={1}>
                              Membro
                            </Badge>
                          )}
                        </Flex>
                      </Box>

                      <Button
                        onClick={() => handleManageMembers(account.id, account.account_name)}
                        size="sm"
                        leftIcon={<UserPlus size={16} />}
                        ml={4}
                        flexShrink={0}
                      >
                        Membros
                      </Button>
                    </Flex>

                    {/* Balances using BalanceCard molecule */}
                    <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3}>
                      <BalanceCard
                        label="Disponível"
                        amount={Number(account.available_balance)}
                        variant="available"
                      />
                      <BalanceCard
                        label="Bloqueado"
                        amount={Number(account.locked_balance)}
                        variant="locked"
                      />
                      <BalanceCard
                        label="Reserva"
                        amount={Number(account.emergency_reserve)}
                        variant="reserve"
                      />
                      <BalanceCard
                        label="Total"
                        amount={Number(account.total_balance)}
                        variant="total"
                      />
                    </SimpleGrid>
                  </Box>
                ))}

                {accounts?.length === 0 && (
                  <Center py={8}>
                    <Text color="gray.500">Nenhuma conta encontrada</Text>
                  </Center>
                )}
              </Stack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

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
