import bcrypt from "bcrypt";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { seedAdmin, type SeedConfig } from "../src/cli/seed.js";
import {
  createTestPrisma,
  hasTestDatabase,
  migrateTestDatabase,
  truncateAll,
} from "./helpers/db.js";

const describeDb = hasTestDatabase ? describe : describe.skip;
const db = (hasTestDatabase ? createTestPrisma() : null) as PrismaClient;

function config(overrides: Partial<SeedConfig> = {}): SeedConfig {
  return {
    bootstrapAdminEmail: "bootstrap@example.test",
    bootstrapAdminName: "Bootstrap Admin",
    bootstrapAdminPassword: "BootstrapPassword123!",
    ...overrides,
  };
}

describeDb("seed CLI", () => {
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

  it("is idempotent and creates exactly one admin", async () => {
    const output: string[] = [];
    const write = (chunk: string) => output.push(chunk);

    const first = await seedAdmin({ prisma: db, config: config(), write });
    const second = await seedAdmin({ prisma: db, config: config(), write });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(await db.account.count()).toBe(1);

    const admin = await db.account.findFirstOrThrow({
      include: { metadata: true, roles: true },
    });
    expect(admin.roles.map((entry) => entry.role)).toEqual(["tech_admin"]);
    expect(admin.mustChangePassword).toBe(true);
    expect(admin.status).toBe("active");
    expect(
      await bcrypt.compare(config().bootstrapAdminPassword!, admin.password!),
    ).toBe(true);
    expect(output).toHaveLength(0);
  });

  it("prints a generated password once and never stores it in plain text", async () => {
    const output: string[] = [];
    const write = (chunk: string) => output.push(chunk);

    const first = await seedAdmin({
      prisma: db,
      config: config({ bootstrapAdminPassword: undefined }),
      write,
    });
    const second = await seedAdmin({
      prisma: db,
      config: config({ bootstrapAdminPassword: undefined }),
      write,
    });

    expect(first.created).toBe(true);
    expect(first.generatedPassword).toBeDefined();
    expect(first.generatedPassword!.length).toBeGreaterThanOrEqual(24);
    expect(second.created).toBe(false);
    expect(output).toHaveLength(1);
    expect(output[0]).toContain("shown only once");
    expect(
      output[0]!.match(new RegExp(first.generatedPassword!, "g")),
    ).toHaveLength(1);

    const admin = await db.account.findFirstOrThrow();
    expect(admin.password).not.toBe(first.generatedPassword);
    expect(JSON.stringify(admin)).not.toContain(first.generatedPassword!);
    expect(await bcrypt.compare(first.generatedPassword!, admin.password!)).toBe(
      true,
    );
  });

  it("requires an email on the first run", async () => {
    await expect(
      seedAdmin({
        prisma: db,
        config: config({ bootstrapAdminEmail: undefined }),
        write: () => undefined,
      }),
    ).rejects.toThrow("BOOTSTRAP_ADMIN_EMAIL");
  });
});
