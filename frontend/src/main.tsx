import React from 'react'
import ReactDOM from 'react-dom/client'
import { ChakraProvider, extendTheme } from '@chakra-ui/react'
import App from './App.tsx'
import './index.css'

// Chakra UI theme usando os Design Tokens do index.css
const theme = extendTheme({
  fonts: {
    heading: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
    body: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
  },
  colors: {
    brand: {
      50: 'rgb(var(--clr-blue-50))',
      100: 'rgb(var(--clr-blue-100))',
      200: 'rgb(var(--clr-blue-200))',
      500: 'rgb(var(--clr-blue-500))',
      600: 'rgb(var(--clr-blue-600))',
      700: 'rgb(var(--clr-blue-700))',
      800: 'rgb(var(--clr-blue-800))',
    },
  },
  space: {
    xs: 'var(--space-2)',
    sm: 'var(--space-3)',
    md: 'var(--space-4)',
    lg: 'var(--space-6)',
    xl: 'var(--space-8)',
  },
  fontSizes: {
    xs: 'var(--font-size-xs)',
    sm: 'var(--font-size-sm)',
    md: 'var(--font-size-base)',
    lg: 'var(--font-size-lg)',
    xl: 'var(--font-size-xl)',
    '2xl': 'var(--font-size-2xl)',
    '4xl': 'var(--font-size-4xl)',
  },
  radii: {
    xs: 'var(--radius-xs)',
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)',
  },
  shadows: {
    xs: 'var(--shadow-xs)',
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
    xl: 'var(--shadow-xl)',
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <App />
    </ChakraProvider>
  </React.StrictMode>,
)
