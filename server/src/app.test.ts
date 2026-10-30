import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import { loadConfig } from "./config/index.js";
import { createLogger } from "./logger.js";

const baseEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL: "mysql://user:password@localhost:3306/app",
  SESSION_SECRET: "a".repeat(32),
  CORS_ORIGINS: "http://localhost:2173",
  LOG_LEVEL: "silent",
  LOG_FORMAT: "json",
};

const config = loadConfig(baseEnv);
const logger = createLogger(config);
const prisma = {} as PrismaClient;

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("createApp", () => {
  it("constructs with a fake Prisma client and serves a request", async () => {
    const app = createApp({ config, logger, prisma });
    const response = await request(app).get("/healthz");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns a JSON 404 for an unknown API route", async () => {
    const app = createApp({ config, logger, prisma });
    const response = await request(app).get("/api/auth/fetch");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("not_found");
  });

  it("importing the Prisma module does not connect", async () => {
    const module = await import("./db/prisma.js");

    expect(module.createPrismaClient).toBeTypeOf("function");
  });

  describe("headless mode", () => {
    it("returns a JSON service banner instead of HTML at /", async () => {
      const app = createApp({ config, logger, prisma });
      const response = await request(app).get("/");

      expect(response.status).toBe(200);
      expect(response.type).toBe("application/json");
      expect(response.body).toEqual({
        service: "unah-red-tutores-api",
        version: "0.0.0",
      });
    });

    it("does not serve a client directory when SERVE_CLIENT is false", async () => {
      const directory = mkdtempSync(path.join(tmpdir(), "headless-"));
      temporaryDirectories.push(directory);
      writeFileSync(path.join(directory, "index.html"), "spa-index");

      const headlessConfig = loadConfig({
        ...baseEnv,
        SERVE_CLIENT: "false",
        CLIENT_DIR: directory,
      });
      const app = createApp({
        config: headlessConfig,
        logger,
        prisma,
      });
      const response = await request(app).get("/");

      expect(response.type).toBe("application/json");
      expect(response.text).not.toContain("spa-index");
    });
  });

  describe("all-in-one mode", () => {
    function spaApp() {
      const directory = mkdtempSync(path.join(tmpdir(), "client-dist-"));
      temporaryDirectories.push(directory);
      writeFileSync(
        path.join(directory, "index.html"),
        "<html><body>spa-index</body></html>",
      );

      const spaConfig = loadConfig({
        ...baseEnv,
        SERVE_CLIENT: "true",
        CLIENT_DIR: directory,
      });

      return createApp({ config: spaConfig, logger, prisma });
    }

    it("serves index.html at / and for deep links", async () => {
      const app = spaApp();

      const root = await request(app).get("/");
      expect(root.status).toBe(200);
      expect(root.text).toContain("spa-index");

      const deepLink = await request(app).get("/admin/items");
      expect(deepLink.status).toBe(200);
      expect(deepLink.text).toContain("spa-index");
    });

    it("never lets the SPA fallback swallow API or health routes", async () => {
      const app = spaApp();

      const api = await request(app).get("/api/auth/fetch");
      expect(api.status).toBe(404);
      expect(api.body.error.code).toBe("not_found");
      expect(api.text).not.toContain("spa-index");

      const health = await request(app).get("/healthz");
      expect(health.status).toBe(200);
      expect(health.body).toEqual({ status: "ok" });
      expect(health.text).not.toContain("spa-index");
    });
  });
});
