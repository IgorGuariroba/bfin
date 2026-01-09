/**
 * Spacing tokens for Chakra UI
 * Using direct values instead of CSS variables for better compatibility
 */

export const space = {
  0: '0',
  0.5: '0.125rem',   // 2px
  1: '0.25rem',      // 4px
  2: '0.5rem',       // 8px
  3: '0.75rem',      // 12px
  4: '1rem',         // 16px
  5: '1.25rem',      // 20px
  6: '1.5rem',       // 24px
  8: '2rem',         // 32px
  10: '2.5rem',      // 40px
  12: '3rem',        // 48px
  16: '4rem',        // 64px
  20: '5rem',        // 80px
  24: '6rem',        // 96px

  // Semantic aliases
  xs: '0.5rem',      // 8px
  sm: '0.75rem',     // 12px
  md: '1rem',        // 16px
  lg: '1.5rem',      // 24px
  xl: '2rem',        // 32px
  '2xl': '2.5rem',   // 40px
};

/**
 * Size tokens for width, height, maxWidth, etc.
 * Inherits from space but can be extended independently
 */
export const sizes = {
  ...space,

  // Container sizes
  container: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  // Special sizes
  full: '100%',
  min: 'min-content',
  max: 'max-content',
  fit: 'fit-content',
};
