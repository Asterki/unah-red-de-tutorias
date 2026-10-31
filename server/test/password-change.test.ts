import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/index.js";
import { createLogger } from "../src/logger.js";
import {
  createTestPrisma,
  hasTestDatabase,
  migrateTestDatabase,
  seedAccount,
  TEST_PASSWORD,
  truncateAll,
} from "./helpers/db.js";
import { csrfToken, loginAgent } from "./helpers/http.js";

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

describeDb("forced password change", () => {
  beforeAll(async () => {
    migrateTestDatabase();
    await db.$connect();
  });

  beforeEach(async () => {
    await truncateAll(db);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("blocks everything except self-service auth until the password changes", async () => {
    const account = await seedAccount(db, {
      role: "tech_admin",
      mustChangePassword: true,
    });
    const agent = await loginAgent(app, account.email, TEST_PASSWORD);

    await agent.get("/api/auth/me").expect(200);
    const blocked = await agent.get("/api/accounts").expect(403);
    expect(blocked.body.error.code).toBe("password-change-required");

    const token = await csrfToken(agent);
    const wrong = await agent
      .post("/api/auth/change-password")
      .set("x-csrf-token", token)
      .send({
        currentPassword: "NotThePassword123!",
        newPassword: "ChangedPassword123!",
      })
      .expect(400);
    expect(wrong.body.error.message).toBe("invalid-current-password");

    const unchanged = await db.account.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(unchanged.mustChangePassword).toBe(true);

    const changed = await agent
      .post("/api/auth/change-password")
      .set("x-csrf-token", token)
      .send({
        currentPassword: TEST_PASSWORD,
        newPassword: "ChangedPassword123!",
      })
      .expect(200);
    expect(changed.body.data.mustChangePassword).toBe(false);

    await agent.get("/api/accounts").expect(200);

    const fresh = await db.account.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(fresh.mustChangePassword).toBe(false);
    expect(fresh.password).not.toBe(TEST_PASSWORD);
  });

  it("rejects the old password after a change", async () => {
    const account = await seedAccount(db, {
      role: "tech_admin",
      mustChangePassword: true,
    });
    const agent = await loginAgent(app, account.email, TEST_PASSWORD);
    const token = await csrfToken(agent);

    await agent
      .post("/api/auth/change-password")
      .set("x-csrf-token", token)
      .send({
        currentPassword: TEST_PASSWORD,
        newPassword: "ChangedPassword123!",
      })
      .expect(200);

    const fresh = request.agent(app);
    const freshToken = await csrfToken(fresh);
    await fresh
      .post("/api/auth/login")
      .set("x-csrf-token", freshToken)
      .send({ email: account.email, password: TEST_PASSWORD })
      .expect(401);

    const nextAgent = request.agent(app);
    const nextToken = await csrfToken(nextAgent);
    await nextAgent
      .post("/api/auth/login")
      .set("x-csrf-token", nextToken)
      .send({ email: account.email, password: "ChangedPassword123!" })
      .expect(200);
  });
});
