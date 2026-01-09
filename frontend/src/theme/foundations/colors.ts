/**
 * Color palette for Chakra UI
 *
 * IMPORTANTE: Todas as cores semânticas usam variáveis CSS definidas em index.css
 * Isso garante uma única fonte de verdade e facilita mudanças globais.
 *
 * Para cores de paleta (brand, purple, gray, etc.), usamos valores hex
 * que correspondem aos tokens CSS definidos em index.css.
 */

export const colors = {
  // ═══════════════════════════════════════════════════════════════════════════
  // CORES SEMÂNTICAS (usando CSS Variables)
  // Estas são as cores principais da interface - definidas em index.css
  // ═══════════════════════════════════════════════════════════════════════════
  semantic: {
    background: 'var(--background)',
    foreground: 'var(--foreground)',
    card: 'var(--card)',
    cardForeground: 'var(--card-foreground)',
    popover: 'var(--popover)',
    popoverForeground: 'var(--popover-foreground)',
    primary: 'var(--primary)',
    primaryForeground: 'var(--primary-foreground)',
    secondary: 'var(--secondary)',
    secondaryForeground: 'var(--secondary-foreground)',
    muted: 'var(--muted)',
    mutedForeground: 'var(--muted-foreground)',
    accent: 'var(--accent)',
    accentForeground: 'var(--accent-foreground)',
    border: 'var(--border)',
    input: 'var(--input)',
    ring: 'var(--ring)',
    // Status
    success: 'var(--success)',
    successForeground: 'var(--success-foreground)',
    warning: 'var(--warning)',
    warningForeground: 'var(--warning-foreground)',
    destructive: 'var(--destructive)',
    destructiveForeground: 'var(--destructive-foreground)',
    info: 'var(--info)',
    infoForeground: 'var(--info-foreground)',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PALETAS DE CORES (valores hex para uso em colorScheme do Chakra)
  // Correspondem às variáveis --purple-*, --green-*, etc. em index.css
  // ═══════════════════════════════════════════════════════════════════════════

  // Brand = Purple (Primary)
  brand: {
    50: 'var(--purple-50)',
    100: 'var(--purple-100)',
    200: 'var(--purple-200)',
    300: 'var(--purple-300)',
    400: 'var(--purple-400)',
    500: 'var(--purple-500)',
    600: 'var(--purple-600)',
    700: 'var(--purple-700)',
    800: 'var(--purple-800)',
    900: 'var(--purple-900)',
  },

  // Purple palette
  purple: {
    50: 'var(--purple-50)',
    100: 'var(--purple-100)',
    200: 'var(--purple-200)',
    300: 'var(--purple-300)',
    400: 'var(--purple-400)',
    500: 'var(--purple-500)',
    600: 'var(--purple-600)',
    700: 'var(--purple-700)',
    800: 'var(--purple-800)',
    900: 'var(--purple-900)',
  },

  // Gray palette (com tom roxo)
  gray: {
    50: 'var(--gray-50)',
    100: 'var(--gray-100)',
    200: 'var(--gray-200)',
    300: 'var(--gray-300)',
    400: 'var(--gray-400)',
    500: 'var(--gray-500)',
    600: 'var(--gray-600)',
    700: 'var(--gray-700)',
    800: 'var(--gray-800)',
    900: 'var(--gray-900)',
  },

  // Green palette (Success - Teal)
  green: {
    50: 'var(--green-50)',
    100: 'var(--green-100)',
    200: 'var(--green-200)',
    300: 'var(--green-300)',
    400: 'var(--green-400)',
    500: 'var(--green-500)',
    600: 'var(--green-600)',
    700: 'var(--green-700)',
    800: 'var(--green-800)',
    900: 'var(--green-900)',
  },

  // Red palette (Destructive - Magenta)
  red: {
    50: 'var(--red-50)',
    100: 'var(--red-100)',
    200: 'var(--red-200)',
    300: 'var(--red-300)',
    400: 'var(--red-400)',
    500: 'var(--red-500)',
    600: 'var(--red-600)',
    700: 'var(--red-700)',
    800: 'var(--red-800)',
    900: 'var(--red-900)',
  },

  // Yellow palette (Warning - Amber)
  yellow: {
    50: 'var(--yellow-50)',
    100: 'var(--yellow-100)',
    200: 'var(--yellow-200)',
    300: 'var(--yellow-300)',
    400: 'var(--yellow-400)',
    500: 'var(--yellow-500)',
    600: 'var(--yellow-600)',
    700: 'var(--yellow-700)',
    800: 'var(--yellow-800)',
    900: 'var(--yellow-900)',
  },

  // Blue palette (Info - Indigo)
  blue: {
    50: 'var(--blue-50)',
    100: 'var(--blue-100)',
    200: 'var(--blue-200)',
    300: 'var(--blue-300)',
    400: 'var(--blue-400)',
    500: 'var(--blue-500)',
    600: 'var(--blue-600)',
    700: 'var(--blue-700)',
    800: 'var(--blue-800)',
    900: 'var(--blue-900)',
  },

  // Orange palette
  orange: {
    50: '#FFF5EB',
    100: '#FFE8D5',
    200: '#FFD0AA',
    300: '#FFB580',
    400: '#FF9955',
    500: '#EB8232',
    600: '#D26923',
    700: '#B45518',
    800: '#944510',
    900: '#78380C',
  },
};
