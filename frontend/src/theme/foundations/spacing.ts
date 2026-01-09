/**
 * Spacing tokens mapping CSS variables to Chakra UI
 * Used for margin, padding, gap, etc.
 */

export const space = {
  0: 'var(--space-0)',       // 0
  0.5: 'var(--space-0-5)',   // 0.125rem (2px)
  1: 'var(--space-1)',       // 0.25rem (4px)
  2: 'var(--space-2)',       // 0.5rem (8px)
  3: 'var(--space-3)',       // 0.75rem (12px)
  4: 'var(--space-4)',       // 1rem (16px)
  5: 'var(--space-5)',       // 1.25rem (20px)
  6: 'var(--space-6)',       // 1.5rem (24px)
  8: 'var(--space-8)',       // 2rem (32px)
  10: 'var(--space-10)',     // 2.5rem (40px)
  12: 'var(--space-12)',     // 3rem (48px)
  16: 'var(--space-16)',     // 4rem (64px)

  // Semantic aliases
  xs: 'var(--space-2)',      // 0.5rem
  sm: 'var(--space-3)',      // 0.75rem
  md: 'var(--space-4)',      // 1rem
  lg: 'var(--space-6)',      // 1.5rem
  xl: 'var(--space-8)',      // 2rem
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
