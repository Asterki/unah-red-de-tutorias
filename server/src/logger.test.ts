import express from "express";
import request from "supertest";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";

import { createLogger } from "./logger.js";
import { requestLogger } from "./middleware/request-logger.js";

const config = {
  serviceName: "unah-red-tutores-api-test",
  nodeEnv: "test" as const,
  logLevel: "debug" as const,
  logFormat: "json" as const,
};

function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  return { logger: createLogger(config, stream), output: () => lines.join("") };
}

describe("logger redaction", () => {
  it("redacts passwords and database URLs", () => {
    const { logger, output } = captureLogger();

    logger.info(
      {
        password: "plain-password",
        newPassword: "new-plain-password",
        DATABASE_URL: "mysql://user:secret@db/app",
        user: { password: "nested-password", token: "nested-token" },
      },
      "redaction check",
    );

    const serialized = output();
    expect(serialized).not.toContain("plain-password");
    expect(serialized).not.toContain("new-plain-password");
    expect(serialized).not.toContain("nested-password");
    expect(serialized).not.toContain("nested-token");
    expect(serialized).not.toContain("mysql://user:secret@db/app");
    expect(serialized).toContain("[redacted]");
  });
});

describe("request logger", () => {
  it("redacts request body secrets and cookies and returns x-trace-id", async () => {
    const { logger, output } = captureLogger();
    const app = express();
    app.use(requestLogger(logger));
    app.use(express.json());
    app.post("/api/example", (req, res) => {
      req.log.info({ body: req.body }, "request body");
      res.json({ ok: true });
    });

    const traceId = "3d3f9e2a-1b2c-4d5e-8f90-123456789abc";
    const response = await request(app)
      .post("/api/example")
      .set("x-trace-id", traceId)
      .set("cookie", "session=super-secret-cookie")
      .send({ password: "super-secret-password", name: "Ada" });

    expect(response.status).toBe(200);
    expect(response.headers["x-trace-id"]).toBe(traceId);

    await new Promise((resolve) => setImmediate(resolve));
    const serialized = output();
    expect(serialized).not.toContain("super-secret-password");
    expect(serialized).not.toContain("super-secret-cookie");
    expect(serialized).toContain(traceId);
  });

  it("generates a UUID when the incoming trace id is invalid", async () => {
    const { logger } = captureLogger();
    const app = express();
    app.use(requestLogger(logger));
    app.get("/api/example", (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app)
      .get("/api/example")
      .set("x-trace-id", "not-a-uuid");

    expect(response.headers["x-trace-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
