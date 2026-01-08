import { Box, Text, useColorModeValue } from '@chakra-ui/react';

interface BalanceCardProps {
  label: string;
  amount: number;
  variant?: 'available' | 'locked' | 'reserve' | 'total';
}

export function BalanceCard({ label, amount, variant = 'total' }: BalanceCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const variantColors = {
    available: { bg: 'green.50', text: 'green.700' },
    locked: { bg: 'blue.50', text: 'blue.700' },
    reserve: { bg: 'yellow.50', text: 'yellow.700' },
    total: { bg: 'gray.50', text: 'gray.900' },
  };

  const colors = variantColors[variant];

  return (
    <Box
      bg={useColorModeValue(colors.bg, `${colors.bg.split('.')[0]}.800`)}
      px={4}
      py={3}
      borderRadius="lg"
      flex="1"
      minW="140px"
    >
      <Text fontSize="xs" color="gray.600" mb={1.5}>
        {label}
      </Text>
      <Text
        fontWeight="semibold"
        color={useColorModeValue(colors.text, `${colors.text.split('.')[0]}.200`)}
      >
        {formatCurrency(amount)}
      </Text>
    </Box>
  );
}
