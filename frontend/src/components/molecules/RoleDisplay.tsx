import { Badge, Icon } from '@chakra-ui/react';
import { Crown, User, Eye } from 'lucide-react';

interface RoleDisplayProps {
  role: 'owner' | 'member' | 'viewer';
  showLabel?: boolean;
}

export function RoleDisplay({ role, showLabel = true }: RoleDisplayProps) {
  const roleConfig = {
    owner: {
      icon: Crown,
      label: 'Proprietário',
      colorScheme: 'yellow',
    },
    member: {
      icon: User,
      label: 'Membro',
      colorScheme: 'green',
    },
    viewer: {
      icon: Eye,
      label: 'Visualizador',
      colorScheme: 'gray',
    },
  };

  const config = roleConfig[role] || roleConfig.viewer;
  const IconComponent = config.icon;

  if (!showLabel) {
    return <Icon as={IconComponent} w={4} h={4} />;
  }

  return (
    <Badge colorScheme={config.colorScheme} display="inline-flex" alignItems="center" gap={1} fontSize="xs">
      <Icon as={IconComponent} w={3} h={3} />
      {config.label}
    </Badge>
  );
}
