import { forwardRef } from 'react';
import { FormControl, FormLabel, FormErrorMessage, FormHelperText, Select, SelectProps } from '@chakra-ui/react';

interface FormSelectProps extends SelectProps {
  label: string;
  error?: string;
  helperText?: string;
  isRequired?: boolean;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, error, helperText, isRequired, children, ...selectProps }, ref) => {
    return (
      <FormControl isInvalid={!!error} isRequired={isRequired}>
        <FormLabel>{label}</FormLabel>
        <Select ref={ref} {...selectProps}>
          {children}
        </Select>
        {error && <FormErrorMessage>{error}</FormErrorMessage>}
        {helperText && !error && <FormHelperText>{helperText}</FormHelperText>}
      </FormControl>
    );
  }
);

FormSelect.displayName = 'FormSelect';
