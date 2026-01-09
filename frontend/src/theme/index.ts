/**
 * BFIN Design System Theme
 *
 * ARQUITETURA:
 * - Todas as cores são definidas em index.css como variáveis CSS
 * - Este tema mapeia as variáveis CSS para o Chakra UI v3
 * - Mudanças de cor devem ser feitas APENAS em index.css
 *
 * Primary: Violet Purple (#7C3AED)
 */

import { createSystem, defaultConfig } from '@chakra-ui/react';

/**
 * Chakra UI v3 System
 * Usa variáveis CSS para cores semânticas
 */
export const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      colors: {
        // Brand colors (purple)
        'brand.50': { value: 'var(--purple-50)' },
        'brand.100': { value: 'var(--purple-100)' },
        'brand.200': { value: 'var(--purple-200)' },
        'brand.300': { value: 'var(--purple-300)' },
        'brand.400': { value: 'var(--purple-400)' },
        'brand.500': { value: 'var(--purple-500)' },
        'brand.600': { value: 'var(--purple-600)' },
        'brand.700': { value: 'var(--purple-700)' },
        'brand.800': { value: 'var(--purple-800)' },
        'brand.900': { value: 'var(--purple-900)' },

        // Semantic colors
        'bg': { value: 'var(--background)' },
        'fg': { value: 'var(--foreground)' },
        'card': { value: 'var(--card)' },
        'card.fg': { value: 'var(--card-foreground)' },
        'border': { value: 'var(--border)' },
        'muted': { value: 'var(--muted)' },
        'muted.fg': { value: 'var(--muted-foreground)' },
        'primary': { value: 'var(--primary)' },
        'primary.fg': { value: 'var(--primary-foreground)' },
        'secondary': { value: 'var(--secondary)' },
        'secondary.fg': { value: 'var(--secondary-foreground)' },
        'accent': { value: 'var(--accent)' },
        'accent.fg': { value: 'var(--accent-foreground)' },
        'success': { value: 'var(--success)' },
        'success.fg': { value: 'var(--success-foreground)' },
        'warning': { value: 'var(--warning)' },
        'warning.fg': { value: 'var(--warning-foreground)' },
        'error': { value: 'var(--destructive)' },
        'error.fg': { value: 'var(--destructive-foreground)' },
        'info': { value: 'var(--info)' },
        'info.fg': { value: 'var(--info-foreground)' },
      },
    },
  },
  globalCss: {
    'html, body': {
      bg: 'var(--background)',
      color: 'var(--foreground)',
    },
    '*::selection': {
      bg: 'var(--primary)',
      color: 'var(--primary-foreground)',
    },
    '::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
    },
    '::-webkit-scrollbar-track': {
      bg: 'var(--muted)',
    },
    '::-webkit-scrollbar-thumb': {
      bg: 'var(--border)',
      borderRadius: '4px',
    },
    '::-webkit-scrollbar-thumb:hover': {
      bg: 'var(--muted-foreground)',
    },
  },
});
