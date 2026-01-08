import { Button as MantineButton, ButtonProps as MantineButtonProps } from '@mantine/core';

interface ButtonProps extends Omit<MantineButtonProps, 'variant'> {
  variant?: 'primary' | 'secondary' | 'outline';
  isLoading?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  isLoading = false,
  ...props
}: ButtonProps) {
  // Mapear variantes customizadas para variantes do Mantine
  const mantineVariant =
    variant === 'primary' ? 'filled' :
    variant === 'secondary' ? 'light' :
    variant === 'outline' ? 'outline' : 'filled';

  return (
    <MantineButton
      variant={mantineVariant}
      loading={isLoading}
      {...props}
    >
      {children}
    </MantineButton>
  );
}
