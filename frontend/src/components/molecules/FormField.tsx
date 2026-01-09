import { forwardRef } from 'react';
import { Field, Input, InputProps } from '@chakra-ui/react';

interface FormFieldProps extends InputProps {
  label: string;
  error?: string;
  helperText?: string;
  isRequired?: boolean;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, helperText, isRequired, ...inputProps }, ref) => {
    return (
      <Field.Root invalid={!!error} required={isRequired}>
        <Field.Label>{label}</Field.Label>
        <Input ref={ref} {...inputProps} />
        {error && <Field.ErrorText>{error}</Field.ErrorText>}
        {helperText && !error && <Field.HelperText>{helperText}</Field.HelperText>}
      </Field.Root>
    );
  }
);

FormField.displayName = 'FormField';
