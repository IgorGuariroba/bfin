/**
 * Typography tokens mapping CSS variables to Chakra UI
 * Includes fonts, font sizes, font weights, and line heights
 */

export const fonts = {
  heading: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
  body: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
  mono: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
};

export const fontSizes = {
  xs: 'var(--font-size-xs)',     // 0.75rem (12px)
  sm: 'var(--font-size-sm)',     // 0.875rem (14px)
  md: 'var(--font-size-base)',   // 1rem (16px)
  lg: 'var(--font-size-lg)',     // 1.125rem (18px)
  xl: 'var(--font-size-xl)',     // 1.25rem (20px)
  '2xl': 'var(--font-size-2xl)', // 1.5rem (24px)
  '4xl': 'var(--font-size-4xl)', // 2.25rem (36px)
};

export const fontWeights = {
  normal: 'var(--font-weight-normal)',       // 400
  medium: 'var(--font-weight-medium)',       // 500
  semibold: 'var(--font-weight-semibold)',   // 600
  bold: 'var(--font-weight-bold)',           // 700
};

export const lineHeights = {
  xs: 'var(--line-height-xs)',     // 1.25rem
  sm: 'var(--line-height-sm)',     // 1.375rem
  base: 'var(--line-height-base)', // 1.5rem
  lg: 'var(--line-height-lg)',     // 1.75rem
  normal: 'normal',
  none: 1,
  shorter: 1.25,
  short: 1.375,
  tall: 1.625,
  taller: 2,
};
