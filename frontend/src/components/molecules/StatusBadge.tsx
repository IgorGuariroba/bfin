import { Badge } from '@chakra-ui/react';

interface StatusBadgeProps {
  status: 'pending' | 'executed' | 'cancelled' | 'locked';
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig = {
    executed: {
      label: 'Executado',
      colorScheme: 'green',
    },
    locked: {
      label: 'Bloqueado',
      colorScheme: 'blue',
    },
    pending: {
      label: 'Pendente',
      colorScheme: 'yellow',
    },
    cancelled: {
      label: 'Cancelado',
      colorScheme: 'gray',
    },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <Badge colorScheme={config.colorScheme} fontSize="xs">
      {config.label}
    </Badge>
  );
}
