import bcrypt from "bcrypt";
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
const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "mysql://root:root@127.0.0.1:3306/app";

function configFor(
  overrides: Record<string, string | undefined> = {},
): ReturnType<typeof loadConfig> {
  return loadConfig({
    NODE_ENV: "test",
    PORT: "3000",
    DATABASE_URL: databaseUrl,
    SESSION_SECRET: "a".repeat(32),
    CORS_ORIGINS: "http://localhost:2173",
    LOG_LEVEL: "silent",
    LOG_FORMAT: "json",
    ...overrides,
  });
}

function appFor(overrides: Record<string, string | undefined> = {}) {
  const config = configFor(overrides);
  return createApp({ config, logger: createLogger(config), prisma: db });
}

function setCookies(headers: Record<string, unknown>): string[] {
  const value = headers["set-cookie"];
  if (Array.isArray(value)) return value.map(String);
  return value ? [String(value)] : [];
}

describeDb("http hardening", () => {
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

  it("sets hardened session and CSRF cookies in production", async () => {
    const app = appFor({ NODE_ENV: "production", TRUST_PROXY: "1" });
    const account = await seedAccount(db, { role: "tech_admin" });

    const csrfResponse = await request(app)
      .get("/api/auth/csrf")
      .set("X-Forwarded-Proto", "https")
      .expect(200);
    const csrfCookie = setCookies(csrfResponse.headers).find((cookie) =>
      cookie.startsWith("__Host-csrf="),
    );
    expect(csrfCookie).toBeDefined();
    expect(csrfCookie).toMatch(/Secure/i);
    expect(csrfCookie).toMatch(/SameSite=Lax/i);
    expect(csrfCookie).not.toMatch(/HttpOnly/i);

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .set("Cookie", csrfCookie!.split(";")[0]!)
      .set("X-Forwarded-Proto", "https")
      .set("x-csrf-token", csrfResponse.body.csrfToken)
      .send({ email: account.email, password: TEST_PASSWORD })
      .expect(200);

    const sessionCookie = setCookies(loginResponse.headers).find((cookie) =>
      cookie.startsWith("__Host-app.sid="),
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/Secure/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);
    expect(sessionCookie).toMatch(/Path=\//i);
    expect(sessionCookie).not.toMatch(/Domain=/i);
  });

  it("rejects missing and wrong CSRF tokens", async () => {
    const app = appFor();
    const agent = request.agent(app);
    const token = await csrfToken(agent);

    await agent.post("/api/auth/logout").expect(403);
    await agent
      .post("/api/auth/logout")
      .set("x-csrf-token", "wrong")
      .expect(403);
    await agent.post("/api/auth/logout").set("x-csrf-token", token).expect(401);
  });

  it("rejects a disallowed Origin on unsafe methods", async () => {
    const app = appFor();
    const agent = request.agent(app);
    const token = await csrfToken(agent);

    const response = await agent
      .post("/api/auth/login")
      .set("x-csrf-token", token)
      .set("Origin", "https://evil.example")
      .send({ email: "nobody@example.test", password: "wrong-password" });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe("invalid-origin");
  });

  it("enforces the origin secret only when it is configured", async () => {
    const unconfigured = appFor();
    await request(unconfigured).get("/api/auth/csrf").expect(200);

    const app = appFor({ ORIGIN_SECRET: "top-secret" });
    await request(app).get("/api/auth/csrf").expect(403);
    await request(app)
      .get("/api/auth/csrf")
      .set("x-origin-secret", "wrong")
      .expect(403);
    await request(app)
      .get("/api/auth/csrf")
      .set("x-origin-secret", "top-secret")
      .expect(200);

    await request(app).get("/healthz").expect(200);
  });

  it("rate limits the eleventh login attempt", async () => {
    const app = appFor({ LOGIN_RATE_LIMIT_MAX: "10" });
    const agent = request.agent(app);
    const token = await csrfToken(agent);

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await agent
        .post("/api/auth/login")
        .set("x-csrf-token", token)
        .send({ email: "nobody@example.test", password: "wrong-password" })
        .expect(401);
    }

    await agent
      .post("/api/auth/login")
      .set("x-csrf-token", token)
      .send({ email: "nobody@example.test", password: "wrong-password" })
      .expect(429);
  });

  it("updates lastLogin and rehashes an old bcrypt cost", async () => {
    const app = appFor();
    const account = await seedAccount(db, {
      role: "general_admin",
      password: TEST_PASSWORD,
    });
    expect(bcrypt.getRounds(account.password!)).toBe(4);

    const agent = await loginAgent(app, account.email, TEST_PASSWORD);
    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.data.lastLogin).toBeTypeOf("string");

    const updated = await db.account.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(updated.lastLogin).toBeInstanceOf(Date);
    expect(bcrypt.getRounds(updated.password!)).toBe(12);
  });

  it("destroys the session on logout", async () => {
    const app = appFor();
    const account = await seedAccount(db, { role: "tech_admin" });
    const agent = await loginAgent(app, account.email, TEST_PASSWORD);

    await agent.get("/api/auth/me").expect(200);
    const token = await csrfToken(agent);
    await agent.post("/api/auth/logout").set("x-csrf-token", token).expect(200);
    await agent.get("/api/auth/me").expect(401);

    expect(await db.session.count()).toBe(0);
  });

  it("sets helmet security headers", async () => {
    const app = appFor();
    const response = await request(app).get("/healthz").expect(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });
});
