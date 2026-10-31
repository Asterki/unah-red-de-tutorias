import express, { type Express } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { AppError } from "../src/http/errors.js";
import {
  isOAuthOriginSecretBypass,
  OAUTH_ORIGIN_SECRET_BYPASS_ROUTES,
  originSecret,
} from "../src/middleware/origin-secret.js";

type NodeEnv = "development" | "test" | "production";

const SECRET = "top-secret";

function appFor(nodeEnv: NodeEnv): Express {
  const app = express();
  app.use("/api", originSecret({ originSecret: SECRET, nodeEnv }, { warn: vi.fn() }));
  for (const route of OAUTH_ORIGIN_SECRET_BYPASS_ROUTES) {
    const [method, path] = route.split(" ") as ["GET" | "POST", string];
    app[method.toLowerCase() as "get" | "post"](path, (_req, res) => {
      res.status(204).end();
    });
  }
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status = error instanceof AppError ? error.status : 500;
      res.status(status).json({ error: true });
    },
  );
  return app;
}

function call(app: Express, route: string) {
  const [method, path] = route.split(" ") as ["GET" | "POST", string];
  return request(app)[method === "GET" ? "get" : "post"](path);
}

describe("OAuth origin-secret bypass allowlist", () => {
  for (const route of OAUTH_ORIGIN_SECRET_BYPASS_ROUTES) {
    const [, path] = route.split(" ") as [string, string];
    const method = route.split(" ")[0]!;

    it(`allows ${route} in development`, async () => {
      expect(isOAuthOriginSecretBypass("development", method, path)).toBe(true);
      await call(appFor("development"), route).expect(204);
    });

    it(`denies ${route} in production`, async () => {
      expect(isOAuthOriginSecretBypass("production", method, path)).toBe(false);
      await call(appFor("production"), route).expect(403);
    });

    it(`denies ${route} in test`, async () => {
      expect(isOAuthOriginSecretBypass("test", method, path)).toBe(false);
      await call(appFor("test"), route).expect(403);
    });
  }

  const deniedInDevelopment = [
    "GET /api/accounts",
    "GET /api/auth/microsoft/../accounts",
    "GET /api/auth/microsoftx",
    "POST /api/auth/microsoft",
    "GET /api/auth/apple/callback",
    "POST /api/auth/google/callback",
  ];

  for (const route of deniedInDevelopment) {
    it(`denies ${route} in development`, async () => {
      const [method, path] = route.split(" ") as ["GET" | "POST", string];
      expect(isOAuthOriginSecretBypass("development", method, path)).toBe(
        false,
      );
      await call(appFor("development"), route).expect(403);
    });
  }

  it("still accepts the secret on a denied route", async () => {
    await request(appFor("development"))
      .get("/api/accounts")
      .set("x-origin-secret", SECRET)
      .expect(404);
  });
});

describe("origin-secret startup warning", () => {
  it("logs once in development when the secret is configured", () => {
    const warn = vi.fn();
    originSecret({ originSecret: SECRET, nodeEnv: "development" }, { warn });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "origin-secret bypass active for OAuth routes (development only)",
    );
  });

  it("does not log outside development", () => {
    for (const nodeEnv of ["test", "production"] as const) {
      const warn = vi.fn();
      originSecret({ originSecret: SECRET, nodeEnv }, { warn });
      expect(warn).not.toHaveBeenCalled();
    }
  });

  it("does not log when no secret is configured", () => {
    const warn = vi.fn();
    originSecret({ originSecret: undefined, nodeEnv: "development" }, { warn });
    expect(warn).not.toHaveBeenCalled();
  });
});
