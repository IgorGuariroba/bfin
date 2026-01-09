/**
 * BFIN Design System Theme
 * Complete Chakra UI theme with all CSS tokens mapped
 */

import { extendTheme } from '@chakra-ui/react';
import {
  colors,
  fonts,
  fontSizes,
  fontWeights,
  lineHeights,
  space,
  sizes,
  shadows,
  radii,
} from './foundations';

/**
 * Extended Chakra UI theme
 * Maps all CSS design tokens to Chakra's theme structure
 */
export const theme = extendTheme({
  // Color tokens - includes all palettes
  colors,

  // Typography tokens
  fonts,
  fontSizes,
  fontWeights,
  lineHeights,

  // Spacing & sizing tokens
  space,
  sizes,

  // Visual tokens
  shadows,
  radii,

  // Global styles
  styles: {
    global: {
      body: {
        bg: 'gray.50',
        color: 'gray.900',
      },
    },
  },

  // Component defaults
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
    },
    Input: {
      defaultProps: {
        focusBorderColor: 'brand.500',
      },
    },
    Select: {
      defaultProps: {
        focusBorderColor: 'brand.500',
      },
    },
    Textarea: {
      defaultProps: {
        focusBorderColor: 'brand.500',
      },
    },
  },

  // Semantic tokens for dark mode support
  semanticTokens: {
    colors: {
      'chakra-body-bg': { _light: 'gray.50', _dark: 'gray.900' },
      'chakra-body-text': { _light: 'gray.900', _dark: 'gray.50' },
      'chakra-border-color': { _light: 'gray.300', _dark: 'gray.700' },
      'chakra-placeholder-color': { _light: 'gray.500', _dark: 'gray.400' },
    },
  },

  // Configuration
  config: {
    initialColorMode: 'light',
    useSystemColorMode: false,
  },
});
