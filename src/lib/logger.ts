import { pino } from "pino";
import { config } from "../config.js";

export const logger = pino({
  level: config.logLevel,
  redact: {
    paths: ["password", "token", "authorization", "cookie"],
    censor: "[Redacted]",
  },
});
