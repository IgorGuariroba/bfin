function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? "3000"),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: getRequiredEnv("DATABASE_URL"),
} as const;
