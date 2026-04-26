import { describe, it, expect, vi } from "vitest";
import { buildOriginGuard } from "../src/mcp/transport/origin-guard.js";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { Logger } from "pino";

function mockLogger(): Logger {
  return {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    level: "info",
    silent: vi.fn(),
  } as unknown as Logger;
}

function mockRequest(origin: string | undefined, url = "/mcp", ip = "127.0.0.1") {
  return {
    headers: { ...(origin ? { origin } : {}) },
    url,
    ip,
  } as unknown as FastifyRequest;
}

function mockReply() {
  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as FastifyReply;
  return reply;
}

describe("origin guard", () => {
  const allowedOrigins = new Set(["https://api.bfincont.com.br", "http://localhost:3000"]);

  it("allows request with allowed origin", () => {
    const guard = buildOriginGuard({
      allowedOrigins,
      logger: mockLogger(),
    });
    const req = mockRequest("https://api.bfincont.com.br");
    const reply = mockReply();
    const done = vi.fn();

    guard(req, reply, done);
    expect(done).toHaveBeenCalled();
    expect(reply.code as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it("rejects request with disallowed origin", () => {
    const logger = mockLogger();
    const guard = buildOriginGuard({
      allowedOrigins,
      logger,
    });
    const req = mockRequest("https://attacker.example");
    const reply = mockReply();
    const done = vi.fn();

    guard(req, reply, done);
    expect(reply.code as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(403);
    expect(done).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("allows server-to-server request without origin", () => {
    const guard = buildOriginGuard({
      allowedOrigins,
      logger: mockLogger(),
    });
    const req = mockRequest(undefined);
    const reply = mockReply();
    const done = vi.fn();

    guard(req, reply, done);
    expect(done).toHaveBeenCalled();
    expect(reply.code as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it("allows request without origin in development", () => {
    const guard = buildOriginGuard({
      allowedOrigins,
      logger: mockLogger(),
    });
    const req = mockRequest(undefined);
    const reply = mockReply();
    const done = vi.fn();

    guard(req, reply, done);
    expect(done).toHaveBeenCalled();
    expect(reply.code as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it("allows localhost origin", () => {
    const guard = buildOriginGuard({
      allowedOrigins,
      logger: mockLogger(),
    });
    const req = mockRequest("http://localhost:3000");
    const reply = mockReply();
    const done = vi.fn();

    guard(req, reply, done);
    expect(done).toHaveBeenCalled();
  });

  it("allows localhost origin with any port", () => {
    const guard = buildOriginGuard({
      allowedOrigins,
      logger: mockLogger(),
    });
    const req = mockRequest("http://localhost:5173");
    const reply = mockReply();
    const done = vi.fn();

    guard(req, reply, done);
    expect(done).toHaveBeenCalled();
  });

  it("rejects localhost without port", () => {
    const logger = mockLogger();
    const guard = buildOriginGuard({
      allowedOrigins,
      logger,
    });
    const req = mockRequest("http://localhost");
    const reply = mockReply();
    const done = vi.fn();

    guard(req, reply, done);
    expect(reply.code as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(403);
  });
});
