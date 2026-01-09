import { Alert } from '@chakra-ui/react';
import { ReactNode } from 'react';

interface InfoBoxProps {
  variant?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children: ReactNode;
}

export function InfoBox({ variant = 'info', title, children }: InfoBoxProps) {
  const statusMap = {
    info: 'info',
    warning: 'warning',
    error: 'error',
    success: 'success',
  } as const;

  return (
    <Alert.Root status={statusMap[variant]} borderRadius="md">
      <Alert.Indicator />
      <Alert.Content>
        {title && <Alert.Title>{title}</Alert.Title>}
        <Alert.Description>{children}</Alert.Description>
      </Alert.Content>
    </Alert.Root>
  );
}
