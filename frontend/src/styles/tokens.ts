/**
 * Design Tokens - Type-safe references to CSS Variables
 *
 * This file provides TypeScript constants that mirror the CSS variables
 * defined in index.css. Use these tokens for dynamic styles and inline styling.
 */

export const tokens = {
  colors: {
    blue: {
      50: 'rgb(var(--clr-blue-50))',
      100: 'rgb(var(--clr-blue-100))',
      200: 'rgb(var(--clr-blue-200))',
      500: 'rgb(var(--clr-blue-500))',
      600: 'rgb(var(--clr-blue-600))',
      700: 'rgb(var(--clr-blue-700))',
      800: 'rgb(var(--clr-blue-800))',
    },
    green: {
      50: 'rgb(var(--clr-green-50))',
      100: 'rgb(var(--clr-green-100))',
      600: 'rgb(var(--clr-green-600))',
      700: 'rgb(var(--clr-green-700))',
    },
    red: {
      50: 'rgb(var(--clr-red-50))',
      500: 'rgb(var(--clr-red-500))',
      600: 'rgb(var(--clr-red-600))',
      700: 'rgb(var(--clr-red-700))',
    },
    yellow: {
      50: 'rgb(var(--clr-yellow-50))',
      100: 'rgb(var(--clr-yellow-100))',
      600: 'rgb(var(--clr-yellow-600))',
      700: 'rgb(var(--clr-yellow-700))',
    },
    orange: {
      500: 'rgb(var(--clr-orange-500))',
      600: 'rgb(var(--clr-orange-600))',
      700: 'rgb(var(--clr-orange-700))',
    },
    purple: {
      50: 'rgb(var(--clr-purple-50))',
      100: 'rgb(var(--clr-purple-100))',
      600: 'rgb(var(--clr-purple-600))',
      800: 'rgb(var(--clr-purple-800))',
    },
    gray: {
      50: 'rgb(var(--clr-gray-50))',
      100: 'rgb(var(--clr-gray-100))',
      300: 'rgb(var(--clr-gray-300))',
      400: 'rgb(var(--clr-gray-400))',
      500: 'rgb(var(--clr-gray-500))',
      600: 'rgb(var(--clr-gray-600))',
      700: 'rgb(var(--clr-gray-700))',
      900: 'rgb(var(--clr-gray-900))',
    },
  },
  spacing: {
    0: 'var(--space-0)',
    0.5: 'var(--space-0-5)',
    1: 'var(--space-1)',
    2: 'var(--space-2)',
    3: 'var(--space-3)',
    4: 'var(--space-4)',
    5: 'var(--space-5)',
    6: 'var(--space-6)',
    8: 'var(--space-8)',
    10: 'var(--space-10)',
    12: 'var(--space-12)',
    16: 'var(--space-16)',
  },
  fontSize: {
    xs: 'var(--font-size-xs)',
    sm: 'var(--font-size-sm)',
    base: 'var(--font-size-base)',
    lg: 'var(--font-size-lg)',
    xl: 'var(--font-size-xl)',
    '2xl': 'var(--font-size-2xl)',
    '4xl': 'var(--font-size-4xl)',
  },
  fontWeight: {
    normal: 'var(--font-weight-normal)',
    medium: 'var(--font-weight-medium)',
    semibold: 'var(--font-weight-semibold)',
    bold: 'var(--font-weight-bold)',
  },
  lineHeight: {
    xs: 'var(--line-height-xs)',
    sm: 'var(--line-height-sm)',
    base: 'var(--line-height-base)',
    lg: 'var(--line-height-lg)',
  },
  shadow: {
    xs: 'var(--shadow-xs)',
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
    xl: 'var(--shadow-xl)',
  },
  radius: {
    xs: 'var(--radius-xs)',
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)',
    full: 'var(--radius-full)',
  },
  duration: {
    fast: 'var(--duration-fast)',
    base: 'var(--duration-base)',
    slow: 'var(--duration-slow)',
  },
  easing: {
    linear: 'var(--easing-linear)',
    easeIn: 'var(--easing-ease-in)',
    easeOut: 'var(--easing-ease-out)',
    easeInOut: 'var(--easing-ease-in-out)',
  },
} as const;

// Type exports for autocomplete and type safety
export type TokenColor = keyof typeof tokens.colors;
export type TokenSpacing = keyof typeof tokens.spacing;
export type TokenFontSize = keyof typeof tokens.fontSize;
export type TokenFontWeight = keyof typeof tokens.fontWeight;
export type TokenLineHeight = keyof typeof tokens.lineHeight;
export type TokenShadow = keyof typeof tokens.shadow;
export type TokenRadius = keyof typeof tokens.radius;
export type TokenDuration = keyof typeof tokens.duration;
export type TokenEasing = keyof typeof tokens.easing;

/**
 * Usage examples:
 *
 * import { tokens } from '@/styles/tokens';
 *
 * // For inline styles
 * <div style={{ color: tokens.colors.blue[600], padding: tokens.spacing[4] }}>
 *
 * // For conditional styling with cn()
 * <div className={cn("p-4", isActive && "text-blue-600")}>
 *
 * // Note: Prefer using Tailwind classes when possible for better tree-shaking
 */
