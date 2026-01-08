/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // Semantic colors (existing)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Color palette tokens
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
        xs: ['var(--font-size-xs)', { lineHeight: 'var(--line-height-xs)' }],
        sm: ['var(--font-size-sm)', { lineHeight: 'var(--line-height-sm)' }],
        base: ['var(--font-size-base)', { lineHeight: 'var(--line-height-base)' }],
        lg: ['var(--font-size-lg)', { lineHeight: 'var(--line-height-lg)' }],
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
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
