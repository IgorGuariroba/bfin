import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import App from './App.tsx'
import './index.css'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/dates/styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider
      theme={{
        primaryColor: 'blue',
        fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',

        // Spacing tokens
        spacing: {
          xs: 'var(--space-2)',
          sm: 'var(--space-3)',
          md: 'var(--space-4)',
          lg: 'var(--space-6)',
          xl: 'var(--space-8)',
        },

        // Typography tokens
        fontSizes: {
          xs: 'var(--font-size-xs)',
          sm: 'var(--font-size-sm)',
          md: 'var(--font-size-base)',
          lg: 'var(--font-size-lg)',
          xl: 'var(--font-size-xl)',
        },

        // Border radius tokens
        radius: {
          xs: 'var(--radius-xs)',
          sm: 'var(--radius-sm)',
          md: 'var(--radius-md)',
          lg: 'var(--radius-lg)',
          xl: 'var(--radius-xl)',
        },

        // Shadow tokens
        shadows: {
          xs: 'var(--shadow-xs)',
          sm: 'var(--shadow-sm)',
          md: 'var(--shadow-md)',
          lg: 'var(--shadow-lg)',
          xl: 'var(--shadow-xl)',
        },
      }}
    >
      <Notifications position="top-right" />
      <App />
    </MantineProvider>
  </React.StrictMode>,
)
