import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  VStack,
  HStack,
  Progress,
  IconButton,
  Spinner,
  Center,
  Stack,
} from '@chakra-ui/react';
import { ArrowLeft } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { useTotalDailyLimit, useSpendingHistory } from '../hooks/useDailyLimit';
import { SpendingHistoryChart } from '../components/organisms/charts';

export function DailyLimitPage() {
  const navigate = useNavigate();
  const { data: accounts, isLoading: loadingAccounts } = useAccounts();
  const accountIds = accounts?.map((acc) => acc.id) || [];
  const { data: dailyLimit, isLoading: loadingDailyLimit } = useTotalDailyLimit(accountIds);
  const { data: spendingHistory, isLoading: loadingHistory } = useSpendingHistory(accountIds, 30);

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
              <IconButton
                aria-label="Voltar"
                icon={<ArrowLeft size={20} />}
                onClick={() => navigate('/dashboard')}
                variant="ghost"
                size="sm"
              />
              <Heading size="lg" color="brand.600">BFIN</Heading>
              <Text color="gray.600">Limite Diário Sugerido</Text>
            </HStack>
          </Flex>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="7xl" py={8}>
        <VStack spacing={6} align="stretch">
          {/* Daily Limit Summary Card */}
          {!loadingDailyLimit && !loadingAccounts && dailyLimit && dailyLimit.totalDailyLimit > 0 && (
            <Box bg="white" borderRadius="lg" shadow="md" p={6}>
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontSize="sm" fontWeight="medium" color="gray.500" mb={2}>
                    Limite Diário Sugerido
                  </Text>
                  <Text fontSize="3xl" fontWeight="bold" color="blue.600">
                    {formatCurrency(dailyLimit.totalDailyLimit)}
                  </Text>
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    Baseado no seu saldo disponível dividido por 30 dias
                  </Text>
                </Box>

                <Box pt={4} borderTopWidth="1px" borderColor="gray.200">
                  <Flex justify="space-between" align="center" mb={2}>
                    <Text fontSize="sm" color="gray.600">Gasto hoje</Text>
                    <Text fontSize="lg" fontWeight="semibold" color="gray.900">
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
                    size="lg"
                    borderRadius="full"
                    mb={2}
                  />
                  <Flex justify="space-between" align="center">
                    <Text fontSize="xs" color="gray.500">
                      {dailyLimit.percentageUsed.toFixed(1)}% do limite usado
                    </Text>
                    {dailyLimit.exceeded ? (
                      <Text fontSize="sm" color="red.600" fontWeight="semibold">
                        Excedido em {formatCurrency(dailyLimit.totalSpentToday - dailyLimit.totalDailyLimit)}
                      </Text>
                    ) : (
                      <Text fontSize="sm" color={dailyLimit.percentageUsed > 80 ? 'yellow.600' : 'green.600'} fontWeight="semibold">
                        Restam {formatCurrency(dailyLimit.totalRemaining)} hoje
                      </Text>
                    )}
                  </Flex>
                </Box>
              </VStack>
            </Box>
          )}

          {/* Loading State */}
          {(loadingDailyLimit || loadingAccounts) && (
            <Center py={12}>
              <VStack spacing={4}>
                <Spinner size="xl" color="brand.600" thickness="4px" />
                <Text color="gray.600">Carregando informações do limite diário...</Text>
              </VStack>
            </Center>
          )}

          {/* Spending History Chart */}
          {!loadingAccounts && accounts && accounts.length > 0 && (
            <>
              {loadingHistory ? (
                <Box bg="white" p={6} borderRadius="lg" shadow="md">
                  <Center h="200">
                    <VStack spacing={2}>
                      <Spinner size="lg" color="brand.600" />
                      <Text color="gray.600" fontSize="sm">Carregando histórico...</Text>
                    </VStack>
                  </Center>
                </Box>
              ) : (
                <SpendingHistoryChart accountIds={accountIds} days={30} />
              )}
            </>
          )}

          {/* Info Section */}
          <Box bg="blue.50" borderWidth="1px" borderColor="blue.200" borderRadius="lg" p={6}>
            <VStack spacing={3} align="stretch">
              <Heading size="sm" color="blue.900">
                Como funciona o Limite Diário Sugerido?
              </Heading>
              <Stack spacing={2} fontSize="sm" color="blue.800">
                <Text>
                  • O limite é calculado automaticamente dividindo seu saldo disponível por 30 dias
                </Text>
                <Text>
                  • Acompanhe seu progresso diário para manter suas finanças organizadas
                </Text>
                <Text>
                  • Se você exceder o limite, o sistema alertará você para ajustar seus gastos
                </Text>
                <Text>
                  • O limite é recalculado automaticamente quando você recebe novas receitas
                </Text>
              </Stack>
            </VStack>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
