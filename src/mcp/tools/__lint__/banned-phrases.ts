/**
 * Banned phrase patterns for MCP tool descriptions.
 * Each entry is [regex, label] where label describes the violation.
 */
export const BANNED_PHRASES: [RegExp, string][] = [
  [/ignore\s+(all\s+)?previous/i, "prompt injection: ignore previous instructions"],
  [/system\s+prompt/i, "prompt injection: references system prompt"],
  [/override\s+(all\s+)?(previous|prior)/i, "prompt injection: override instructions"],
  [/\bmust\s+call\b/i, "prompt injection: mandates tool invocation"],
  [/\balways\s+invoke\b/i, "prompt injection: mandates tool invocation"],
  [/\bdisregard\b/i, "prompt injection: disregard instructions"],
  [/\bforget\b/i, "prompt injection: forget instructions"],
  [/\bno\s+matter\s+what\b/i, "prompt injection: unconditional instruction"],
  [/\b(best|amazing|powerful|advanced|ultimate|revolutionary|innovative)\b/i, "promotional language"],
  [/\bthe\s+(best|most\s+powerful|most\s+advanced)\b/i, "promotional superlative"],
  [/https?:\/\/(?!localhost|127\.0\.0\.1|api\.bfincont\.com\.br)[^\s"')\]]+/i, "external URL in description"],
];
