/**
 * BFIN Design System Theme
 *
 * ARQUITETURA:
 * - Todas as cores são definidas em index.css como variáveis CSS
 * - Este tema mapeia as variáveis CSS para o Chakra UI
 * - Mudanças de cor devem ser feitas APENAS em index.css
 *
 * Primary: Violet Purple (#7C3AED)
 */

import { extendTheme, type ThemeConfig } from '@chakra-ui/react';
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

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

/**
 * Extended Chakra UI theme
 * Usa variáveis CSS para cores semânticas
 */
export const theme = extendTheme({
  config,

  // Color tokens - paletas e semânticas
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

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL STYLES
  // Usa variáveis CSS para consistência
  // ═══════════════════════════════════════════════════════════════════════════
  styles: {
    global: {
      'html, body': {
        bg: 'var(--background)',
        color: 'var(--foreground)',
      },
      '*::selection': {
        bg: 'var(--primary)',
        color: 'var(--primary-foreground)',
      },
      // Scrollbar personalizada
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
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPONENT STYLES
  // Todos os componentes usam variáveis CSS
  // ═══════════════════════════════════════════════════════════════════════════
  components: {
    // Button
    Button: {
      baseStyle: {
        fontWeight: 'semibold',
        borderRadius: 'var(--radius)',
      },
      variants: {
        solid: {
          bg: 'var(--primary)',
          color: 'var(--primary-foreground)',
          _hover: {
            bg: 'var(--primary)',
            opacity: 0.9,
          },
        },
        outline: {
          borderColor: 'var(--border)',
          color: 'var(--foreground)',
          _hover: {
            bg: 'var(--secondary)',
          },
        },
        ghost: {
          color: 'var(--foreground)',
          _hover: {
            bg: 'var(--accent)',
            color: 'var(--accent-foreground)',
          },
        },
        destructive: {
          bg: 'var(--destructive)',
          color: 'var(--destructive-foreground)',
          _hover: {
            opacity: 0.9,
          },
        },
      },
      defaultProps: {
        variant: 'solid',
      },
    },

    // Input
    Input: {
      baseStyle: {
        field: {
          bg: 'var(--input)',
          borderColor: 'var(--border)',
          color: 'var(--foreground)',
          _placeholder: {
            color: 'var(--muted-foreground)',
          },
          _focus: {
            borderColor: 'var(--ring)',
            boxShadow: '0 0 0 1px var(--ring)',
          },
        },
      },
      defaultProps: {
        variant: 'outline',
      },
    },

    // Select
    Select: {
      baseStyle: {
        field: {
          bg: 'var(--input)',
          borderColor: 'var(--border)',
          color: 'var(--foreground)',
        },
      },
    },

    // Textarea
    Textarea: {
      baseStyle: {
        bg: 'var(--input)',
        borderColor: 'var(--border)',
        color: 'var(--foreground)',
        _placeholder: {
          color: 'var(--muted-foreground)',
        },
        _focus: {
          borderColor: 'var(--ring)',
          boxShadow: '0 0 0 1px var(--ring)',
        },
      },
    },

    // Card
    Card: {
      baseStyle: {
        container: {
          bg: 'var(--card)',
          color: 'var(--card-foreground)',
          borderColor: 'var(--border)',
          borderRadius: 'var(--radius)',
        },
      },
    },

    // Heading
    Heading: {
      baseStyle: {
        color: 'var(--foreground)',
      },
    },

    // Text
    Text: {
      baseStyle: {
        color: 'var(--foreground)',
      },
    },

    // FormLabel
    FormLabel: {
      baseStyle: {
        color: 'var(--foreground)',
        fontWeight: 'medium',
      },
    },

    // Link
    Link: {
      baseStyle: {
        color: 'var(--accent)',
        _hover: {
          color: 'var(--accent-foreground)',
          textDecoration: 'underline',
        },
      },
    },

    // Divider
    Divider: {
      baseStyle: {
        borderColor: 'var(--border)',
      },
    },

    // Alert
    Alert: {
      variants: {
        success: {
          container: {
            bg: 'var(--success)',
            color: 'var(--success-foreground)',
          },
        },
        warning: {
          container: {
            bg: 'var(--warning)',
            color: 'var(--warning-foreground)',
          },
        },
        error: {
          container: {
            bg: 'var(--destructive)',
            color: 'var(--destructive-foreground)',
          },
        },
        info: {
          container: {
            bg: 'var(--info)',
            color: 'var(--info-foreground)',
          },
        },
      },
    },

    // Menu / Popover
    Menu: {
      baseStyle: {
        list: {
          bg: 'var(--popover)',
          borderColor: 'var(--border)',
        },
        item: {
          bg: 'var(--popover)',
          color: 'var(--popover-foreground)',
          _hover: {
            bg: 'var(--accent)',
          },
          _focus: {
            bg: 'var(--accent)',
          },
        },
      },
    },

    // Modal
    Modal: {
      baseStyle: {
        dialog: {
          bg: 'var(--card)',
          color: 'var(--card-foreground)',
        },
        header: {
          color: 'var(--foreground)',
        },
        body: {
          color: 'var(--foreground)',
        },
        footer: {
          borderTopColor: 'var(--border)',
        },
      },
    },

    // Tooltip
    Tooltip: {
      baseStyle: {
        bg: 'var(--popover)',
        color: 'var(--popover-foreground)',
        borderRadius: 'var(--radius)',
      },
    },

    // Badge
    Badge: {
      baseStyle: {
        borderRadius: 'var(--radius)',
      },
      variants: {
        solid: {
          bg: 'var(--primary)',
          color: 'var(--primary-foreground)',
        },
        outline: {
          borderColor: 'var(--border)',
          color: 'var(--foreground)',
        },
        subtle: {
          bg: 'var(--muted)',
          color: 'var(--muted-foreground)',
        },
      },
    },

    // Table
    Table: {
      variants: {
        simple: {
          th: {
            borderColor: 'var(--border)',
            color: 'var(--muted-foreground)',
          },
          td: {
            borderColor: 'var(--border)',
          },
          tbody: {
            tr: {
              _hover: {
                bg: 'var(--muted)',
              },
            },
          },
        },
      },
    },

    // Tabs
    Tabs: {
      variants: {
        line: {
          tab: {
            color: 'var(--muted-foreground)',
            _selected: {
              color: 'var(--foreground)',
              borderColor: 'var(--primary)',
            },
            _hover: {
              color: 'var(--foreground)',
            },
          },
        },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SEMANTIC TOKENS
  // Mapeamento para suporte a dark mode via Chakra
  // ═══════════════════════════════════════════════════════════════════════════
  semanticTokens: {
    colors: {
      // Chakra internal tokens
      'chakra-body-bg': 'var(--background)',
      'chakra-body-text': 'var(--foreground)',
      'chakra-border-color': 'var(--border)',
      'chakra-placeholder-color': 'var(--muted-foreground)',
    },
  },
});
