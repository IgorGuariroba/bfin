/**
 * Border radius tokens mapping CSS variables to Chakra UI
 * Used for rounded corners on components
 */

export const radii = {
  none: '0',
  xs: 'var(--radius-xs)',     // 0.125rem (2px)
  sm: 'var(--radius-sm)',     // 0.25rem (4px)
  md: 'var(--radius-md)',     // 0.375rem (6px)
  lg: 'var(--radius-lg)',     // 0.5rem (8px)
  xl: 'var(--radius-xl)',     // 0.75rem (12px)
  full: 'var(--radius-full)', // 9999px (circular)

  // Base radius (default)
  base: 'var(--radius-lg)',
};
