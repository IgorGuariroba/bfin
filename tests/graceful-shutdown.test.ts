import { describe, it, expect } from "vitest";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { spawn } from "node:child_process";
import path from "node:path";

function waitForServer(url: string, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) {
          resolve();
          return;
        }
      } catch {
        // ignore
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("Server did not start in time"));
        return;
      }
      setTimeout(check, 200);
    };
    check();
  });
}

describe("Graceful shutdown", () => {
  it("drains requests and exits cleanly on SIGTERM", async () => {
    const container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const databaseUrl = container.getConnectionUri();

    const child = spawn("node", ["--import", "tsx", path.resolve("src/server.ts")], {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        PORT: "34567",
        NODE_ENV: "test",
        LOG_LEVEL: "info",
      },
      stdio: ["ignore", "pipe", "pipe"],
      cwd: path.resolve("."),
    });

    let serverUrl = "";
    let output = "";
    child.stdout.on("data", (data: Buffer) => {
      output += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      output += data.toString();
    });

    // Wait for the server to log its port
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Server startup timeout: " + output)), 15_000);
      const check = () => {
        const match = output.match(/Server listening at http:\/\/(\S+):(\d+)/);
        if (match) {
          serverUrl = `http://${match[1]}:${match[2]}`;
          clearTimeout(timer);
          resolve();
          return;
        }
        setTimeout(check, 200);
      };
      check();
    });

    await waitForServer(`${serverUrl}/health/live`);

    const exitPromise = new Promise<number>((resolve) => {
      child.on("exit", (code) => {
        resolve(code ?? 1);
      });
    });

    child.kill("SIGTERM");

    const exitCode = await exitPromise;
    expect(exitCode).toBe(0);

    await container.stop();
  }, 30_000);
});
