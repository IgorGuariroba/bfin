import { Button as MantineButton, ButtonProps as MantineButtonProps } from '@mantine/core';

interface ButtonProps extends Omit<MantineButtonProps, 'variant' | 'loading'> {
  variant?: 'primary' | 'secondary' | 'outline';
  isLoading?: boolean;
  onClick?: () => void | Promise<void>;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  className?: string;
}

export function Button({
  children,
  variant = 'primary',
  isLoading = false,
  onClick,
  type,
  disabled,
  className,
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
      onClick={onClick}
      type={type}
      disabled={disabled}
      className={className}
      {...props}
    >
      {children}
    </MantineButton>
  );
}
