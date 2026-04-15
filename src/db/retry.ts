import { client } from "./index.js";

export async function waitForDatabase(options: {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  maxTotalMs?: number;
} = {}): Promise<void> {
  const {
    initialDelayMs = 500,
    maxDelayMs = 5000,
    maxTotalMs = 30_000,
  } = options;

  const start = Date.now();
  let delay = initialDelayMs;

  while (true) {
    try {
      await client`SELECT 1`;
      return;
    } catch (err) {
      const elapsed = Date.now() - start;
      if (elapsed + delay > maxTotalMs) {
        throw new Error(
          `Database not ready after ${maxTotalMs}ms: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      await sleep(delay);
      delay = Math.min(delay * 2, maxDelayMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
