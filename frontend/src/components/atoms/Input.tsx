import { Input as ChakraInput, InputProps as ChakraInputProps, Field } from '@chakra-ui/react';
import { forwardRef } from 'react';

export type InputProps = ChakraInputProps;

export const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return <ChakraInput ref={ref} {...props} />;
});

Input.displayName = 'Input';

// Export form components for convenience (Field components)
export const FormControl = Field.Root;
export const FormLabel = Field.Label;
export const FormErrorMessage = Field.ErrorText;
export const FormHelperText = Field.HelperText;
