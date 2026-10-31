import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/index.js";
import { createLogger } from "../src/logger.js";
import {
  createTestPrisma,
  hasTestDatabase,
  migrateTestDatabase,
  seedAccount,
  truncateAll,
} from "./helpers/db.js";
import { loginAgent } from "./helpers/http.js";

const describeDb = hasTestDatabase ? describe : describe.skip;
const db = (hasTestDatabase ? createTestPrisma() : null) as PrismaClient;

const docsDir = mkdtempSync(path.join(tmpdir(), "docs-api-"));
writeFileSync(
  path.join(docsDir, "manifest.json"),
  JSON.stringify([
    { slug: "index", title: "Operator documentation" },
    { slug: "evil", title: "Escaping symlink" },
  ]),
);
writeFileSync(path.join(docsDir, "index.md"), "# Operators\n\nHello.\n");
const outside = mkdtempSync(path.join(tmpdir(), "docs-api-outside-"));
writeFileSync(path.join(outside, "secret.md"), "# Secret\n");
symlinkSync(path.join(outside, "secret.md"), path.join(docsDir, "evil.md"));

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
  DOCS_DIR: docsDir,
});

const app = createApp({ config, logger: createLogger(config), prisma: db });

describeDb("in-app docs API", () => {
  beforeAll(async () => {
    migrateTestDatabase();
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
    rmSync(docsDir, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it("allows every role with docs:read", async () => {
    await truncateAll(db);

    for (const role of ["tech_admin", "general_admin"] as const) {
      const account = await seedAccount(db, { role });
      const agent = await loginAgent(app, account.email, "InitialPassword123!");
      const list = await agent.get("/api/docs");
      expect(list.status).toBe(200);
      expect(list.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ slug: "index" }),
        ]),
      );

      const page = await agent.get("/api/docs/index");
      expect(page.status).toBe(200);
      expect(page.body).toMatchObject({
        slug: "index",
        title: "Operator documentation",
      });
      expect(page.body.markdown).toContain("# Operators");
    }

    for (const role of ["student", "external", "observer"] as const) {
      const account = await seedAccount(db, { role });
      const agent = await loginAgent(app, account.email, "InitialPassword123!");
      const list = await agent.get("/api/docs").expect(200);
      expect(list.body).toEqual(
        expect.arrayContaining([expect.objectContaining({ slug: "index" })]),
      );
    }
  });

  it("rejects traversal, absolute paths, null bytes and escaping symlinks", async () => {
    await truncateAll(db);
    const account = await seedAccount(db, { role: "tech_admin" });
    const agent = await loginAgent(app, account.email, "InitialPassword123!");

    for (const pathname of [
      "/api/docs/..",
      "/api/docs/..%2Fsecret",
      "/api/docs/%2e%2e%2fsecret",
      "/api/docs/%2Fetc%2Fpasswd",
      "/api/docs/%00index",
      "/api/docs/evil",
      "/api/docs/missing",
    ]) {
      const response = await agent.get(pathname);
      expect([400, 404], `${pathname} returned ${response.status}`).toContain(
        response.status,
      );
      expect(response.body.markdown).toBeUndefined();
    }
  });

  it("returns 401 without a session", async () => {
    await request(app).get("/api/docs").expect(401);
    await request(app).get("/api/docs/index").expect(401);
  });
});
