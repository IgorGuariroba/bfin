import React from 'react';
import {
  Box,
  Text,
  Spinner,
  Center,
  Stack,
  SimpleGrid,
  Icon,
} from '@chakra-ui/react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { useSpendingHistory } from '../../../hooks/useDailyLimit';

interface SpendingHistoryChartProps {
  accountIds: string[];
  days?: number;
}

interface ChartDataItem {
  date: string;
  spent: number;
  dailyLimit: number;
  percentageUsed: number;
  status: 'ok' | 'warning' | 'exceeded';
}

const SpendingHistoryChart: React.FC<SpendingHistoryChartProps> = ({
  accountIds,
  days = 7,
}) => {
  const { data, isLoading, isError } = useSpendingHistory(accountIds, days);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  };

  const formatFullDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const day = date.getDate();
    const monthNames = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];
    return `${day} de ${monthNames[date.getMonth()]}`;
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatCompactCurrency = (value: number): string => {
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(1)}k`;
    }
    return `R$ ${value}`;
  };

  const getBarColor = (entry: ChartDataItem): string => {
    if (entry.status === 'exceeded') return '#dc2626'; // red
    if (entry.status === 'warning') return '#eab308'; // yellow
    return '#2563eb'; // blue
  };

  const CustomTooltip = ({
    active,
    payload,
  }: TooltipProps<number, string>) => {
    if (active && payload && payload.length > 0 && payload[0]) {
      const data = (payload[0] as any).payload as ChartDataItem;

      return (
        <Box bg="white" p={3} borderWidth="1px" borderColor="gray.200" borderRadius="md" shadow="lg">
          <Text fontWeight="semibold" color="gray.900" mb={2}>
            {formatFullDate(data.date)}
          </Text>
          <Stack gap={1}>
            <Text fontSize="sm">
              <Text as="span" color="gray.600">Gasto: </Text>
              <Text
                as="span"
                fontWeight="semibold"
                color={
                  data.status === 'exceeded'
                    ? 'red.600'
                    : data.status === 'warning'
                    ? 'yellow.600'
                    : 'blue.600'
                }
              >
                {formatCurrency(data.spent)}
              </Text>
            </Text>
            <Text fontSize="sm">
              <Text as="span" color="gray.600">Limite: </Text>
              <Text as="span" fontWeight="medium" color="gray.900">
                {formatCurrency(data.dailyLimit)}
              </Text>
            </Text>
            <Text fontSize="xs" color="gray.500" mt={2}>
              {data.percentageUsed.toFixed(0)}% do limite usado
            </Text>
          </Stack>
        </Box>
      );
    }

    return null;
  };

  const chartData: ChartDataItem[] =
    data?.history.map((item) => ({
      date: item.date,
      spent: item.spent,
      dailyLimit: item.dailyLimit,
      percentageUsed: item.percentageUsed,
      status: item.status,
    })) || [];

  if (isLoading) {
    return (
      <Box bg="white" p={6} borderRadius="lg" shadow="md" mb={6}>
        <Text fontSize="lg" fontWeight="semibold" color="gray.900" mb={4}>
          Histórico de Gastos (Últimos {days} dias)
        </Text>
        <Center h="80">
          <Spinner size="xl" colorPalette="brand" />
        </Center>
      </Box>
    );
  }

  if (isError) {
    return (
      <Box bg="white" p={6} borderRadius="lg" shadow="md" mb={6}>
        <Text fontSize="lg" fontWeight="semibold" color="gray.900" mb={4}>
          Histórico de Gastos (Últimos {days} dias)
        </Text>
        <Center h="80">
          <Stack gap={1} align="center">
            <Text fontSize="lg" fontWeight="medium" color="red.600">
              Erro ao carregar histórico
            </Text>
            <Text fontSize="sm" color="gray.500">
              Tente novamente em alguns instantes
            </Text>
          </Stack>
        </Center>
      </Box>
    );
  }

  if (!data || chartData.length === 0) {
    return (
      <Box bg="white" p={6} borderRadius="lg" shadow="md" mb={6}>
        <Text fontSize="lg" fontWeight="semibold" color="gray.900" mb={4}>
          Histórico de Gastos (Últimos {days} dias)
        </Text>
        <Center h="80">
          <Stack gap={3} align="center">
            <Icon as={BarChart3} boxSize={12} color="gray.400" />
            <Text fontSize="lg" fontWeight="medium" color="gray.500">
              Nenhum gasto registrado
            </Text>
            <Text fontSize="sm" color="gray.400">
              Não há gastos nos últimos {days} dias
            </Text>
          </Stack>
        </Center>
      </Box>
    );
  }

  return (
    <Box bg="white" p={6} borderRadius="lg" shadow="md" mb={6}>
      <Text fontSize="lg" fontWeight="semibold" color="gray.900" mb={4}>
        Histórico de Gastos (Últimos {days} dias)
      </Text>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={formatCompactCurrency}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '14px' }}
            iconType="circle"
          />
          <Bar
            dataKey="dailyLimit"
            fill="#d1d5db"
            name="Limite Diário"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="spent"
            name="Gasto"
            radius={[4, 4, 0, 0]}
            fill="#2563eb"
            shape={(props: any) => {
              const { x, y, width, height, payload } = props;
              const color = getBarColor(payload);
              return (
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  fill={color}
                  rx={4}
                  ry={4}
                />
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>

      {data && (
        <Box mt={4} pt={4} borderTopWidth="1px" borderColor="gray.200">
          <SimpleGrid columns={3} gap={4} textAlign="center">
            <Box>
              <Text fontSize="sm" color="gray.600">Total Gasto</Text>
              <Text fontSize="lg" fontWeight="semibold" color="gray.900">
                {formatCurrency(data.totalSpent)}
              </Text>
            </Box>
            <Box>
              <Text fontSize="sm" color="gray.600">Média Diária</Text>
              <Text fontSize="lg" fontWeight="semibold" color="gray.900">
                {formatCurrency(data.averageDailySpent)}
              </Text>
            </Box>
            <Box>
              <Text fontSize="sm" color="gray.600">Dias com Gastos</Text>
              <Text fontSize="lg" fontWeight="semibold" color="gray.900">
                {data.daysWithSpending}
              </Text>
            </Box>
          </SimpleGrid>
        </Box>
      )}
    </Box>
  );
};

export default SpendingHistoryChart;
