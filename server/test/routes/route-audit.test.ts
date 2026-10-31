import type { Router } from "express";
import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config/index.js";
import { resolveProviders } from "../../src/auth/providers.js";
import { createHealthRouter } from "../../src/routes/health.js";
import { createAuthRouter } from "../../src/routes/auth.js";
import { createAccountsRouter } from "../../src/routes/accounts.js";
import { createRolesRouter } from "../../src/routes/roles.js";
import { createDocsRouter } from "../../src/routes/docs.js";
import { createDocsService } from "../../src/services/docs-service.js";
import type { AccountService } from "../../src/services/account-service.js";

type Handle = {
  authenticatedGuard?: boolean;
  requiredPermission?: string;
};

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: Handle }>;
  };
};

type StackRouter = {
  stack: Layer[];
};

const publicRoutes = new Set([
  "POST /api/auth/login",
  "GET /api/auth/csrf",
  "GET /api/auth/providers",
  "GET /api/auth/microsoft",
  "GET /api/auth/microsoft/callback",
  "GET /api/auth/google",
  "GET /api/auth/google/callback",
  "GET /api/auth/apple",
  "POST /api/auth/apple/callback",
  "GET /healthz",
  "GET /readyz",
]);

const authenticatedOnlyRoutes = new Set([
  "POST /api/auth/logout",
  "GET /api/auth/me",
  "POST /api/auth/change-password",
]);

function collect(
  router: StackRouter,
  prefix: string,
): Array<{ key: string; handles: Handle[] }> {
  const routes: Array<{ key: string; handles: Handle[] }> = [];

  for (const layer of router.stack) {
    if (!layer.route) continue;
    const path = layer.route.path;
    const fullPath = `${prefix}${path === "/" ? "" : path}` || "/";
    for (const method of Object.keys(layer.route.methods)) {
      routes.push({
        key: `${method.toUpperCase()} ${fullPath}`,
        handles: layer.route.stack.map((entry) => entry.handle),
      });
    }
  }

  return routes;
}

const service = {} as AccountService;
const config = loadConfig({
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL: "mysql://user:password@localhost:3306/app",
  SESSION_SECRET: "a".repeat(32),
  CORS_ORIGINS: "http://localhost:2173",
  LOG_LEVEL: "silent",
  LOG_FORMAT: "json",
});

const routers = [
  {
    prefix: "",
    router: createHealthRouter({ prisma: {} as never, logger: {} as never }),
  },
  { prefix: "/api/auth", router: createAuthRouter(service, config, resolveProviders(config)) },
  { prefix: "/api/accounts", router: createAccountsRouter(service) },
  { prefix: "/api/roles", router: createRolesRouter() },
  {
    prefix: "/api/docs",
    router: createDocsRouter(createDocsService({ docsDir: "docs/in-app" })),
  },
] as Array<{ prefix: string; router: Router }>;

describe("route policy audit", () => {
  const routes = routers.flatMap(({ prefix, router }) =>
    collect(router as unknown as StackRouter, prefix),
  );

  it("discovers the API surface", () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  for (const route of routes) {
    if (publicRoutes.has(route.key)) {
      it(`${route.key} is explicitly public`, () => {
        expect(route.handles.some((handle) => handle.authenticatedGuard)).toBe(
          false,
        );
      });
      continue;
    }

    it(`${route.key} requires authentication`, () => {
      expect(route.handles.some((handle) => handle.authenticatedGuard)).toBe(
        true,
      );
    });

    if (!authenticatedOnlyRoutes.has(route.key)) {
      it(`${route.key} declares a permission`, () => {
        expect(route.handles.some((handle) => handle.requiredPermission)).toBe(
          true,
        );
      });
    }
  }
});
