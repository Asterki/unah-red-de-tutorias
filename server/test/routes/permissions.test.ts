import {
  roleHasPermission,
  type Permission,
  type Role,
} from "@unah-red-tutores/shared";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config/index.js";
import { createLogger } from "../../src/logger.js";
import {
  createTestPrisma,
  hasTestDatabase,
  migrateTestDatabase,
  seedAccount,
  testEmail,
  truncateAll,
} from "../helpers/db.js";
import { csrfToken, loginAgent } from "../helpers/http.js";

const describeDb = hasTestDatabase ? describe : describe.skip;
const db = (hasTestDatabase ? createTestPrisma() : null) as PrismaClient;

const config = loadConfig({
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "mysql://root:root@127.0.0.1:3306/app",
  SESSION_SECRET: "a".repeat(32),
  CORS_ORIGINS: "http://localhost:2173",
  LOG_LEVEL: "silent",
  LOG_FORMAT: "json",
});

const app = createApp({ config, logger: createLogger(config), prisma: db });

type Method = "get" | "post" | "patch" | "delete";

async function login(email: string) {
  return loginAgent(app, email, "InitialPassword123!");
}

describeDb("permission matrix", () => {
  beforeAll(async () => {
    migrateTestDatabase();
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("enforces the shared matrix on every protected endpoint", async () => {
    await truncateAll(db);

    const accounts: Record<Role, { id: string; email: string }> = {} as Record<
      Role,
      { id: string; email: string }
    >;
    for (const role of ["admin", "manager", "staff", "viewer"] as const) {
      const account = await seedAccount(db, { role });
      accounts[role] = { id: account.id, email: account.email };
    }

    const targets = await Promise.all([
      seedAccount(db, { role: "staff" }),
      seedAccount(db, { role: "staff" }),
      seedAccount(db, { role: "staff" }),
      seedAccount(db, { role: "staff" }),
    ]);
    const deletedTargets = await Promise.all([
      seedAccount(db, { role: "staff", deleted: true }),
      seedAccount(db, { role: "staff", deleted: true }),
      seedAccount(db, { role: "staff", deleted: true }),
      seedAccount(db, { role: "staff", deleted: true }),
    ]);

    const roles = ["admin", "manager", "staff", "viewer"] as const;

    for (const [index, role] of roles.entries()) {
      const agent = await login(accounts[role].email);
      const token = await csrfToken(agent);
      const target = targets[index]!;
      const deletedTarget = deletedTargets[index]!;

      const cases: Array<{
        label: string;
        method: Method;
        url: string;
        permission: Permission | null;
        body?: unknown;
      }> = [
        {
          label: "list accounts",
          method: "get",
          url: "/api/accounts",
          permission: "accounts:read",
        },
        {
          label: "get account",
          method: "get",
          url: `/api/accounts/${target.id}`,
          permission: "accounts:read",
        },
        {
          label: "create account",
          method: "post",
          url: "/api/accounts",
          permission: "accounts:create",
          body: {},
        },
        {
          label: "update account",
          method: "patch",
          url: `/api/accounts/${target.id}`,
          permission: "accounts:update",
          body: {},
        },
        {
          label: "update status",
          method: "post",
          url: `/api/accounts/${target.id}/status`,
          permission: "accounts:update-status",
          body: { status: "active" },
        },
        {
          label: "reset password",
          method: "post",
          url: `/api/accounts/${target.id}/password`,
          permission: "accounts:change-password",
          body: { newPassword: "ResetPassword123!" },
        },
        {
          label: "delete account",
          method: "delete",
          url: `/api/accounts/${target.id}`,
          permission: "accounts:delete",
        },
        {
          label: "restore account",
          method: "post",
          url: `/api/accounts/${deletedTarget.id}/restore`,
          permission: "accounts:restore",
        },
        {
          label: "list roles",
          method: "get",
          url: "/api/roles",
          permission: "roles:read",
        },
        {
          label: "me",
          method: "get",
          url: "/api/auth/me",
          permission: null,
        },
      ];

      for (const testCase of cases) {
        let requestBuilder = agent[testCase.method](testCase.url);
        if (testCase.method !== "get") {
          requestBuilder = requestBuilder.set("x-csrf-token", token);
        }
        const response =
          testCase.body === undefined
            ? await requestBuilder
            : await requestBuilder.send(testCase.body as object);

        const allowed =
          testCase.permission === null ||
          roleHasPermission(role, testCase.permission);

        if (allowed) {
          expect(
            [401, 403],
            `${role} should reach ${testCase.label} (got ${response.status})`,
          ).not.toContain(response.status);
        } else {
          expect(
            response.status,
            `${role} should be denied ${testCase.label}`,
          ).toBe(403);
        }
      }
    }
  });

  it("returns 401 for unauthenticated protected requests", async () => {
    await truncateAll(db);
    const anonymous = request.agent(app);
    const token = await csrfToken(anonymous);

    const responses = await Promise.all([
      anonymous.get("/api/accounts"),
      anonymous.get("/api/roles"),
      anonymous.get("/api/auth/me"),
      anonymous.post("/api/auth/logout").set("x-csrf-token", token),
      anonymous
        .post("/api/auth/change-password")
        .set("x-csrf-token", token)
        .send({ currentPassword: "x", newPassword: "NewPassword123!" }),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
    }
  });

  it("returns a session DTO with computed permissions on login and me", async () => {
    await truncateAll(db);
    const staff = await seedAccount(db, {
      role: "staff",
      email: testEmail("me"),
    });
    const agent = await login(staff.email);

    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.data).toMatchObject({
      id: staff.id,
      email: staff.email,
      role: "staff",
    });
    expect(me.body.data.permissions).toContain("accounts:read");
    expect(me.body.data.permissions).not.toContain("accounts:delete");
    expect(me.body.data.password).toBeUndefined();
  });
});
