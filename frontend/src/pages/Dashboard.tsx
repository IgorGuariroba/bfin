import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  VStack,
  HStack,
  Grid,
  GridItem,
  Badge,
  Progress,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Alert,
  AlertIcon,
  AlertTitle,
} from '@chakra-ui/react';
import { Button } from '../components/atoms/Button';
import { IncomeForm, FixedExpenseForm, VariableExpenseForm, CreateAccountForm } from '../components/organisms/forms';
import { AccountsDialog, InvitationsDialog } from '../components/organisms/dialogs';
import { TransactionList } from '../components/organisms/lists';
import { SpendingHistoryChart } from '../components/organisms/charts';
import { useAccounts } from '../hooks/useAccounts';
import { useTotalDailyLimit } from '../hooks/useDailyLimit';
import { useUpcomingFixedExpenses, useMarkAsPaid } from '../hooks/useTransactions';
import { useMyInvitations } from '../hooks/useAccountMembers';
import { Shield, TrendingUp, Calendar, ShoppingCart, Wallet, Mail } from 'lucide-react';
import { ThemeToggle } from '../components/ui/ThemeToggle';

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

  const accountIds = accounts?.map((acc) => acc.id) || [];
  const { data: dailyLimit, isLoading: loadingDailyLimit } = useTotalDailyLimit(accountIds);
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

  const totals = accounts?.reduce(
    (acc, account) => ({
      totalBalance: acc.totalBalance + Number(account.total_balance),
      availableBalance: acc.availableBalance + Number(account.available_balance),
      lockedBalance: acc.lockedBalance + Number(account.locked_balance),
      emergencyReserve: acc.emergencyReserve + Number(account.emergency_reserve),
    }),
    { totalBalance: 0, availableBalance: 0, lockedBalance: 0, emergencyReserve: 0 }
  ) || { totalBalance: 0, availableBalance: 0, lockedBalance: 0, emergencyReserve: 0 };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Box minH="100vh" bg="var(--background)">
      {/* Header */}
      <Box as="header" bg="var(--card)" shadow="sm">
        <Container maxW="7xl" py={4}>
          <Flex align="center" justify="space-between">
            <HStack spacing={4}>
              <Heading size="lg" color="brand.600">BFIN</Heading>
              <Text color="gray.600">Dashboard</Text>
            </HStack>
            <HStack spacing={4}>
              <Text color="gray.700">Olá, {user?.full_name}</Text>
              <Box position="relative">
                <Button
                  variant="outline"
                  onClick={() => setInvitationsDialogOpen(true)}
                  leftIcon={<Mail size={16} />}
                >
                  Convites
                </Button>
                {invitations.length > 0 && (
                  <Badge
                    position="absolute"
                    top="-8px"
                    right="-8px"
                    colorScheme="red"
                    borderRadius="full"
                    fontSize="xs"
                    px={2}
                  >
                    {invitations.length}
                  </Badge>
                )}
              </Box>
              <Button
                variant="outline"
                onClick={() => setManageAccountsDialogOpen(true)}
                leftIcon={<Wallet size={16} />}
              >
                Gerenciar Contas
              </Button>
              <ThemeToggle variant="icon" size="md" />
              <Button variant="outline" onClick={handleSignOut}>
                Sair
              </Button>
            </HStack>
          </Flex>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="7xl" py={8}>
        <VStack spacing={6} align="stretch">
          {/* Daily Limit Alert */}
          {!loadingDailyLimit && !loadingAccounts && dailyLimit && dailyLimit.totalDailyLimit > 0 && (
            <Flex justify="flex-end">
              <Box
                as="button"
                onClick={() => navigate('/daily-limit')}
                w={{ base: 'full', md: '40%' }}
                cursor="pointer"
                transition="all 0.2s"
                _hover={{ transform: 'translateY(-2px)', shadow: 'lg' }}
              >
                <Alert
                  status={
                    dailyLimit.exceeded
                      ? 'error'
                      : dailyLimit.percentageUsed > 80
                      ? 'warning'
                      : 'success'
                  }
                  variant="outline"
                  borderRadius="lg"
                >
                  <AlertIcon />
                  <Box flex="1">
                    <AlertTitle>
                      <VStack spacing={2} align="stretch" w="full">
                        <Flex justify="space-between" align="center">
                          <Text fontSize="sm" fontWeight="semibold">
                            Limite Diário Sugerido
                          </Text>
                          <Text fontSize="xs" opacity={0.8}>
                            ▶ Ver detalhes
                          </Text>
                        </Flex>
                        <Flex justify="space-between" fontSize="xs" opacity={0.9}>
                          <Text>Gasto hoje</Text>
                          <Text fontWeight="medium">
                            {formatCurrency(dailyLimit.totalSpentToday)} / {formatCurrency(dailyLimit.totalDailyLimit)}
                          </Text>
                        </Flex>
                        <Progress
                          value={Math.min(100, dailyLimit.percentageUsed)}
                          colorScheme={
                            dailyLimit.exceeded
                              ? 'red'
                              : dailyLimit.percentageUsed > 80
                              ? 'yellow'
                              : 'green'
                          }
                          size="sm"
                          borderRadius="full"
                        />
                        <Text fontSize="xs">
                          {dailyLimit.exceeded ? (
                            <Text as="span" fontWeight="medium">
                              Excedido em {formatCurrency(dailyLimit.totalSpentToday - dailyLimit.totalDailyLimit)}
                            </Text>
                          ) : (
                            <Text as="span">
                              Restam {formatCurrency(dailyLimit.totalRemaining)} hoje
                            </Text>
                          )}
                        </Text>
                      </VStack>
                    </AlertTitle>
                  </Box>
                </Alert>
              </Box>
            </Flex>
          )}

          {/* Quick Actions */}
          {!loadingAccounts && accounts && accounts.length > 0 && (
            <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4}>
              <GridItem>
                <Box
                  as="button"
                  onClick={() => setIncomeDialogOpen(true)}
                  bgGradient="linear(to-br, green.500, green.600)"
                  _hover={{ bgGradient: 'linear(to-br, green.600, green.700)' }}
                  color="white"
                  borderRadius="lg"
                  p={6}
                  shadow="lg"
                  transition="all 0.2s"
                  _active={{ transform: 'scale(0.95)' }}
                  w="full"
                >
                  <VStack spacing={3}>
                    <Box bg="whiteAlpha.200" p={3} borderRadius="full">
                      <TrendingUp size={32} />
                    </Box>
                    <VStack spacing={1}>
                      <Heading size="md">Nova Receita</Heading>
                      <Text fontSize="sm" color="green.100">Registrar entrada</Text>
                    </VStack>
                  </VStack>
                </Box>
              </GridItem>

              <GridItem>
                <Box
                  as="button"
                  onClick={() => setFixedExpenseDialogOpen(true)}
                  bgGradient="linear(to-br, orange.500, orange.600)"
                  _hover={{ bgGradient: 'linear(to-br, orange.600, orange.700)' }}
                  color="white"
                  borderRadius="lg"
                  p={6}
                  shadow="lg"
                  transition="all 0.2s"
                  _active={{ transform: 'scale(0.95)' }}
                  w="full"
                >
                  <VStack spacing={3}>
                    <Box bg="whiteAlpha.200" p={3} borderRadius="full">
                      <Calendar size={32} />
                    </Box>
                    <VStack spacing={1}>
                      <Heading size="md">Despesa Fixa</Heading>
                      <Text fontSize="sm" color="orange.100">Conta recorrente</Text>
                    </VStack>
                  </VStack>
                </Box>
              </GridItem>

              <GridItem>
                <Box
                  as="button"
                  onClick={() => setVariableExpenseDialogOpen(true)}
                  bgGradient="linear(to-br, red.500, red.600)"
                  _hover={{ bgGradient: 'linear(to-br, red.600, red.700)' }}
                  color="white"
                  borderRadius="lg"
                  p={6}
                  shadow="lg"
                  transition="all 0.2s"
                  _active={{ transform: 'scale(0.95)' }}
                  w="full"
                >
                  <VStack spacing={3}>
                    <Box bg="whiteAlpha.200" p={3} borderRadius="full">
                      <ShoppingCart size={32} />
                    </Box>
                    <VStack spacing={1}>
                      <Heading size="md">Despesa Variável</Heading>
                      <Text fontSize="sm" color="red.100">Gasto do dia</Text>
                    </VStack>
                  </VStack>
                </Box>
              </GridItem>
            </Grid>
          )}

          {/* Available Balance Card */}
          <Box bg="white" borderRadius="lg" shadow="md" p={6}>
            <Flex justify="space-between" align="center" mb={2}>
              <Text fontSize="sm" fontWeight="medium" color="gray.500">
                Saldo Disponível
              </Text>
              <IconButton
                aria-label="Ver Reserva de Emergência"
                icon={<Shield size={20} />}
                onClick={() => setEmergencyReserveDialogOpen(true)}
                size="sm"
                variant="ghost"
                colorScheme="blue"
              />
            </Flex>
            <Box
              as="button"
              onClick={() => setTransactionsDialogOpen(true)}
              cursor="pointer"
              textAlign="left"
              w="full"
            >
              <Text fontSize="4xl" fontWeight="bold" color="green.600" mt={2}>
                {loadingAccounts ? 'Carregando...' : formatCurrency(totals.availableBalance)}
              </Text>
              <Text fontSize="sm" color="gray.500" mt={1}>
                Para gastos · Clique para ver todas as transações
              </Text>
            </Box>
          </Box>

          {/* Upcoming Expenses */}
          <Box bg="white" borderRadius="lg" shadow="md" p={6}>
            <Heading size="md" color="gray.900" mb={4}>
              Próximas Despesas Fixas
            </Heading>
            {loadingUpcomingExpenses ? (
              <Text color="gray.500">Carregando...</Text>
            ) : !upcomingExpenses?.transactions || upcomingExpenses.transactions.length === 0 ? (
              <Box textAlign="center" py={8}>
                <Text color="gray.500">Nenhuma despesa agendada</Text>
              </Box>
            ) : (
              <VStack spacing={3} align="stretch">
                {upcomingExpenses.transactions.map((expense) => {
                  const dueDate = new Date(expense.due_date);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  dueDate.setHours(0, 0, 0, 0);
                  const isOverdue = dueDate < today;

                  return (
                    <Flex
                      key={expense.id}
                      align="center"
                      justify="space-between"
                      p={4}
                      borderWidth="1px"
                      borderColor="gray.200"
                      borderRadius="lg"
                      _hover={{ bg: 'gray.50' }}
                      transition="all 0.2s"
                    >
                      <Box flex="1">
                        <Text fontWeight="medium" color="gray.900">
                          {expense.description}
                        </Text>
                        {expense.category && (
                          <Text fontSize="sm" color="gray.500" mt={1}>
                            {expense.category.name}
                          </Text>
                        )}
                      </Box>
                      <VStack align="flex-end" ml={4} spacing={1}>
                        <Text fontWeight="bold" color="red.600">
                          {formatCurrency(expense.amount)}
                        </Text>
                        <Text
                          fontSize="sm"
                          color={isOverdue ? 'red.600' : 'gray.500'}
                          fontWeight={isOverdue ? 'semibold' : 'normal'}
                        >
                          {isOverdue ? 'Vencida: ' : 'Vencimento: '}
                          {new Date(expense.due_date).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Text>
                        <Button
                          size="sm"
                          variant="outline"
                          colorScheme="green"
                          onClick={() => handleMarkAsPaid(expense.id, expense.description)}
                        >
                          Marcar como Paga
                        </Button>
                      </VStack>
                    </Flex>
                  );
                })}
              </VStack>
            )}
          </Box>

          {/* Create Account Message */}
          {!loadingAccounts && (!accounts || accounts.length === 0) && (
            <Box bg="blue.50" borderWidth="1px" borderColor="blue.200" borderRadius="lg" p={6}>
              <Heading size="md" color="blue.900" mb={2}>
                Bem-vindo ao BFIN!
              </Heading>
              <Text color="blue.700" mb={4}>
                Para começar, você precisa criar uma conta bancária.
              </Text>
              <Button onClick={() => setAccountDialogOpen(true)}>+ Criar Conta</Button>
            </Box>
          )}
        </VStack>
      </Container>

      {/* Modals */}
      <Modal isOpen={incomeDialogOpen} onClose={() => setIncomeDialogOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Nova Receita</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <IncomeForm
              onSuccess={() => setIncomeDialogOpen(false)}
              onCancel={() => setIncomeDialogOpen(false)}
            />
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={fixedExpenseDialogOpen} onClose={() => setFixedExpenseDialogOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Nova Despesa Fixa</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FixedExpenseForm
              onSuccess={() => setFixedExpenseDialogOpen(false)}
              onCancel={() => setFixedExpenseDialogOpen(false)}
            />
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={variableExpenseDialogOpen} onClose={() => setVariableExpenseDialogOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Nova Despesa Variável</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VariableExpenseForm
              onSuccess={() => setVariableExpenseDialogOpen(false)}
              onCancel={() => setVariableExpenseDialogOpen(false)}
            />
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={accountDialogOpen} onClose={() => setAccountDialogOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Criar Conta Bancária</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <CreateAccountForm
              onSuccess={() => setAccountDialogOpen(false)}
              onCancel={() => setAccountDialogOpen(false)}
            />
          </ModalBody>
        </ModalContent>
      </Modal>

      <AccountsDialog
        isOpen={manageAccountsDialogOpen}
        onClose={() => setManageAccountsDialogOpen(false)}
      />

      <Modal isOpen={transactionsDialogOpen} onClose={() => setTransactionsDialogOpen(false)} size="4xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Todas as Transações</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <TransactionList />
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={emergencyReserveDialogOpen} onClose={() => setEmergencyReserveDialogOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <HStack>
              <Shield size={20} color="var(--chakra-colors-blue-600)" />
              <Text>Reserva de Emergência</Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <Box bg="blue.50" borderWidth="1px" borderColor="blue.200" borderRadius="lg" p={4}>
                <Text fontSize="sm" color="blue.800" mb={2}>
                  Sua reserva de emergência é calculada automaticamente como 30% de todas as receitas recebidas.
                </Text>
                <Text fontSize="3xl" fontWeight="bold" color="blue.600">
                  {loadingAccounts ? 'Carregando...' : formatCurrency(totals.emergencyReserve)}
                </Text>
              </Box>

              <VStack spacing={2} align="stretch" fontSize="sm" color="gray.600">
                <Heading size="sm" color="gray.900">Para que serve?</Heading>
                <Box as="ul" pl={6} sx={{ listStyleType: 'disc' }}>
                  <li>Proteção financeira para imprevistos</li>
                  <li>Cobertura para emergências médicas</li>
                  <li>Segurança em caso de perda de renda</li>
                  <li>Reparos urgentes em casa ou veículo</li>
                </Box>
              </VStack>

              <Box bg="gray.50" borderRadius="lg" p={4} fontSize="xs" color="gray.500">
                <Text fontWeight="medium" color="gray.700" mb={1}>Como funciona:</Text>
                <Text>
                  A cada receita recebida, 30% é automaticamente separado para sua reserva de emergência.
                  Os 70% restantes ficam disponíveis para seus gastos do dia a dia.
                </Text>
              </Box>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      <InvitationsDialog
        isOpen={invitationsDialogOpen}
        onClose={() => setInvitationsDialogOpen(false)}
      />
    </Box>
  );
}
