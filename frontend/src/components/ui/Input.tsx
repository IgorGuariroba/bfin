import { forwardRef } from 'react';
import { TextInput, TextInputProps } from '@mantine/core';

interface InputProps extends Omit<TextInputProps, 'error'> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        error={error}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
