import { Input as ChakraInput, InputProps as ChakraInputProps, FormControl, FormLabel, FormErrorMessage, FormHelperText } from '@chakra-ui/react';
import { forwardRef } from 'react';

export type InputProps = ChakraInputProps;

export const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return <ChakraInput ref={ref} {...props} />;
});

Input.displayName = 'Input';

// Export form components for convenience
export { FormControl, FormLabel, FormErrorMessage, FormHelperText };
