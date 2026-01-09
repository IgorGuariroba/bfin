/**
 * Shadow tokens mapping CSS variables to Chakra UI
 * Box shadows for elevation and depth
 */

export const shadows = {
  xs: 'var(--shadow-xs)',   // Subtle shadow
  sm: 'var(--shadow-sm)',   // Small shadow
  md: 'var(--shadow-md)',   // Medium shadow (default)
  lg: 'var(--shadow-lg)',   // Large shadow
  xl: 'var(--shadow-xl)',   // Extra large shadow

  // Base shadow (default)
  base: 'var(--shadow-sm)',

  // Special shadows
  none: 'none',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  outline: '0 0 0 3px rgba(66, 153, 225, 0.5)',

  // Dark shadows for elevated elements
  dark: {
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.2)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.18)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.18)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.12)',
  },
};
