import { forwardRef } from 'react';
import { FormControl, FormLabel, FormErrorMessage, FormHelperText, Input, InputProps } from '@chakra-ui/react';

interface FormFieldProps extends InputProps {
  label: string;
  error?: string;
  helperText?: string;
  isRequired?: boolean;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, helperText, isRequired, ...inputProps }, ref) => {
    return (
      <FormControl isInvalid={!!error} isRequired={isRequired}>
        <FormLabel>{label}</FormLabel>
        <Input ref={ref} {...inputProps} />
        {error && <FormErrorMessage>{error}</FormErrorMessage>}
        {helperText && !error && <FormHelperText>{helperText}</FormHelperText>}
      </FormControl>
    );
  }
);

FormField.displayName = 'FormField';
