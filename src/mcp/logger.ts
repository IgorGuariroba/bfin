import { pino, destination, type Logger } from "pino";
import { config } from "../config.js";

export const mcpLogger: Logger = pino(
  {
    level: config.logLevel,
    base: { source: "mcp" },
    redact: {
      paths: ["password", "token", "authorization", "cookie", "serviceAccountToken"],
      censor: "[Redacted]",
    },
  },
  destination(2)
);
