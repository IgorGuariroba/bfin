import { Alert, AlertIcon, AlertTitle, AlertDescription, Box } from '@chakra-ui/react';
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
    <Alert status={statusMap[variant]} borderRadius="md">
      <AlertIcon />
      <Box>
        {title && <AlertTitle>{title}</AlertTitle>}
        <AlertDescription>{children}</AlertDescription>
      </Box>
    </Alert>
  );
}
