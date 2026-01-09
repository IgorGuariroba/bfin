import { useColorMode } from '../hooks/useColorMode';

/**
 * ColorModeSync Component
 *
 * Sincroniza o colorMode com a classe 'dark' no elemento HTML.
 * Isso permite que as CSS variables definidas em :root e .dark funcionem corretamente.
 */
export function ColorModeSync() {
  useColorMode(); // Apenas inicializa o hook, que já gerencia a classe
  return null;
}
