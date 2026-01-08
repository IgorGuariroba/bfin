import React from 'react';
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
import { useSpendingHistory } from '../../hooks/useDailyLimit';

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

  // Função para formatar data (DD/MM)
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  };

  // Função para formatar data completa (DD de MMM)
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

  // Função para formatar moeda
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Função para formatar moeda compacta (eixo Y)
  const formatCompactCurrency = (value: number): string => {
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(1)}k`;
    }
    return `R$ ${value}`;
  };

  // Função para obter cor da barra baseada no status
  const getBarColor = (entry: ChartDataItem): string => {
    if (entry.status === 'exceeded') return '#dc2626'; // red
    if (entry.status === 'warning') return '#eab308'; // yellow
    return '#2563eb'; // blue
  };

  // Tooltip customizado
  const CustomTooltip = ({
    active,
    payload,
  }: TooltipProps<number, string>) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload as ChartDataItem;

      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">
            {formatFullDate(data.date)}
          </p>
          <div className="space-y-1">
            <p className="text-sm">
              <span className="text-gray-600">Gasto: </span>
              <span
                className={`font-semibold ${
                  data.status === 'exceeded'
                    ? 'text-red-600'
                    : data.status === 'warning'
                    ? 'text-yellow-600'
                    : 'text-blue-600'
                }`}
              >
                {formatCurrency(data.spent)}
              </span>
            </p>
            <p className="text-sm">
              <span className="text-gray-600">Limite: </span>
              <span className="font-medium text-gray-900">
                {formatCurrency(data.dailyLimit)}
              </span>
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {data.percentageUsed.toFixed(0)}% do limite usado
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  // Preparar dados para o chart
  const chartData: ChartDataItem[] =
    data?.history.map((item) => ({
      date: item.date,
      spent: item.spent,
      dailyLimit: item.dailyLimit,
      percentageUsed: item.percentageUsed,
      status: item.status,
    })) || [];

  // Estados de loading e erro
  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Histórico de Gastos (Últimos {days} dias)
        </h2>
        <div className="flex items-center justify-center h-80">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Histórico de Gastos (Últimos {days} dias)
        </h2>
        <div className="flex items-center justify-center h-80">
          <div className="text-center text-red-600">
            <p className="text-lg font-medium">Erro ao carregar histórico</p>
            <p className="text-sm mt-1">
              Tente novamente em alguns instantes
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || chartData.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Histórico de Gastos (Últimos {days} dias)
        </h2>
        <div className="flex items-center justify-center h-80">
          <div className="text-center text-gray-500">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <p className="text-lg font-medium">Nenhum gasto registrado</p>
            <p className="text-sm mt-1">
              Não há gastos nos últimos {days} dias
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Histórico de Gastos (Últimos {days} dias)
      </h2>

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
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600">Total Gasto</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(data.totalSpent)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Média Diária</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(data.averageDailySpent)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Dias com Gastos</p>
              <p className="text-lg font-semibold text-gray-900">
                {data.daysWithSpending}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpendingHistoryChart;
