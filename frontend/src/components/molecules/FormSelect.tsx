import { forwardRef } from 'react';
import { Field, NativeSelect } from '@chakra-ui/react';

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  helperText?: string;
  isRequired?: boolean;
  children?: React.ReactNode;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, error, helperText, isRequired, children, ...selectProps }, ref) => {
    return (
      <Field.Root invalid={!!error} required={isRequired}>
        <Field.Label>{label}</Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field ref={ref} {...selectProps}>
            {children}
          </NativeSelect.Field>
        </NativeSelect.Root>
        {error && <Field.ErrorText>{error}</Field.ErrorText>}
        {helperText && !error && <Field.HelperText>{helperText}</Field.HelperText>}
      </Field.Root>
    );
  }
);

FormSelect.displayName = 'FormSelect';
