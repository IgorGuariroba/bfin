import { useEffect, useState } from 'react';

/**
 * Custom hook para gerenciar color mode
 * Compatível com Chakra UI v3
 */
export function useColorMode() {
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Verificar localStorage
    const stored = localStorage.getItem('chakra-ui-color-mode');
    if (stored === 'dark' || stored === 'light') {
      setColorMode(stored);
    } else {
      // Verificar preferência do sistema
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setColorMode(prefersDark ? 'dark' : 'light');
    }

    // Listener para mudanças no sistema
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('chakra-ui-color-mode')) {
        setColorMode(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleColorMode = () => {
    const newMode = colorMode === 'dark' ? 'light' : 'dark';
    setColorMode(newMode);
    localStorage.setItem('chakra-ui-color-mode', newMode);
    document.documentElement.classList.toggle('dark', newMode === 'dark');
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', colorMode === 'dark');
  }, [colorMode]);

  return { colorMode, toggleColorMode, setColorMode };
}

/**
 * Hook para valores baseados em color mode
 */
export function useColorModeValue<T>(lightValue: T, darkValue: T): T {
  const { colorMode } = useColorMode();
  return colorMode === 'dark' ? darkValue : lightValue;
}
