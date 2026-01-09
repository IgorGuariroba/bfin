import { useEffect } from 'react';
import { useColorMode } from '@chakra-ui/react';

/**
 * ColorModeSync Component
 *
 * Sincroniza o colorMode do Chakra UI com a classe 'dark' no elemento HTML.
 * Isso permite que as CSS variables definidas em :root e .dark funcionem corretamente.
 */
export function ColorModeSync() {
  const { colorMode } = useColorMode();

  useEffect(() => {
    const root = document.documentElement;

    if (colorMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [colorMode]);

  return null;
}
