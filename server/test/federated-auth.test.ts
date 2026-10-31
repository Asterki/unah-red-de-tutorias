import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/index.js";
import { createLogger } from "../src/logger.js";
import { createAccountService } from "../src/services/account-service.js";
import {
  createFederatedAuthService,
  type FederatedProfile,
} from "../src/services/federated-auth.service.js";
import {
  createTestPrisma,
  hasTestDatabase,
  migrateTestDatabase,
  seedAccount,
  testEmail,
  testDatabaseUrl,
  TEST_PASSWORD,
  truncateAll,
} from "./helpers/db.js";
import { csrfToken } from "./helpers/http.js";

const describeDb = hasTestDatabase ? describe : describe.skip;
const db = (hasTestDatabase ? createTestPrisma() : null) as PrismaClient;

const config = loadConfig({
  NODE_ENV: "test",
  PORT: "3000",
  DATABASE_URL: testDatabaseUrl ?? "mysql://root:root@127.0.0.1:3306/app",
  SESSION_SECRET: "a".repeat(32),
  CORS_ORIGINS: "http://localhost:2173",
  LOG_LEVEL: "silent",
  LOG_FORMAT: "json",
  MICROSOFT_ALLOWED_TENANT_IDS: "tenant-a,tenant-b",
});

const federated = createFederatedAuthService(db, {
  microsoftAllowedTenantIds: config.microsoftAllowedTenantIds,
});
const accounts = createAccountService(db, {
  softDeleteHashKey: config.softDeleteHashKey,
});

function microsoft(overrides: Partial<FederatedProfile> = {}): FederatedProfile {
  return {
    provider: "microsoft",
    providerUserId: "ms-1",
    email: "student@unah.hn",
    emailVerified: true,
    name: "Student Person",
    tenantId: "tenant-a",
    ...overrides,
  };
}

function google(overrides: Partial<FederatedProfile> = {}): FederatedProfile {
  return {
    provider: "google",
    providerUserId: "google-1",
    email: "applicant@gmail.com",
    emailVerified: true,
    name: "Applicant Person",
    tenantId: null,
    ...overrides,
  };
}

function apple(overrides: Partial<FederatedProfile> = {}): FederatedProfile {
  return {
    provider: "apple",
    providerUserId: "apple-1",
    email: "applicant@gmail.com",
    emailVerified: true,
    name: "Applicant Person",
    tenantId: null,
    ...overrides,
  };
}

async function accountRow(id: string) {
  return db.account.findUniqueOrThrow({
    where: { id },
    include: {
      roles: true,
      identities: true,
      metadata: { include: { history: true } },
    },
  });
}

describeDb("federated account resolution", () => {
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

  it("creates a Microsoft student with metadata, identity and history", async () => {
    const user = await federated.resolve(microsoft());

    const row = await accountRow(user.id);
    expect(row.email).toBe("student@unah.hn");
    expect(row.name).toBe("Student Person");
    expect(row.password).toBeNull();
    expect(row.mustChangePassword).toBe(false);
    expect(row.lastLogin).toBeInstanceOf(Date);
    expect(row.idType).toBe("account_number");
    expect(row.identifier).toMatch(/^pending:/);
    expect(row.roles.map((role) => role.role)).toEqual(["student"]);
    expect(row.identities).toHaveLength(1);
    expect(row.identities[0]).toMatchObject({
      provider: "microsoft",
      providerUserId: "ms-1",
      email: "student@unah.hn",
    });
    expect(row.metadata.createdBy).toBeNull();
    expect(row.metadata.history).toHaveLength(1);
    expect(row.metadata.history[0]).toMatchObject({
      entityType: "account",
      entityId: row.id,
      updatedById: null,
    });
    expect(row.metadata.history[0]?.changes).toMatchObject({
      provider: "microsoft",
      role: "student",
      source: "federated",
    });
    expect(user.role).toBe("student");
  });

  it("creates a Microsoft observer for unah.edu.hn", async () => {
    const user = await federated.resolve(
      microsoft({
        providerUserId: "ms-staff",
        email: "staff@unah.edu.hn",
        name: "Staff Person",
      }),
    );

    const row = await accountRow(user.id);
    expect(row.roles.map((role) => role.role)).toEqual(["observer"]);
    expect(row.idType).toBe("employee_id");
  });

  it("rejects a Microsoft tenant outside the allowlist", async () => {
    await expect(
      federated.resolve(microsoft({ tenantId: "tenant-evil" })),
    ).rejects.toMatchObject({ code: "tenant-not-allowed" });
    expect(await db.account.count()).toBe(0);
  });

  it("rejects a Microsoft email outside the institutional domains", async () => {
    await expect(
      federated.resolve(microsoft({ email: "someone@gmail.com" })),
    ).rejects.toMatchObject({ code: "domain-not-allowed" });
    await expect(
      federated.resolve(microsoft({ providerUserId: "ms-2", email: "evil@x.unah.hn" })),
    ).rejects.toMatchObject({ code: "domain-not-allowed" });
    expect(await db.account.count()).toBe(0);
  });

  it("rejects Google and Apple institutional addresses", async () => {
    await expect(
      federated.resolve(google({ email: "student@unah.hn" })),
    ).rejects.toMatchObject({ code: "use-microsoft-login" });
    await expect(
      federated.resolve(apple({ email: "staff@unah.edu.hn" })),
    ).rejects.toMatchObject({ code: "use-microsoft-login" });
  });

  it("rejects an unverified Google address", async () => {
    await expect(
      federated.resolve(google({ emailVerified: false })),
    ).rejects.toMatchObject({ code: "email-not-verified" });
  });

  it("rejects a Google hosted domain in the university", async () => {
    await expect(
      federated.resolve(google({ tenantId: "unah.edu.hn" })),
    ).rejects.toMatchObject({ code: "use-microsoft-login" });
  });

  it("attaches Google then Apple with the same email to one account", async () => {
    const first = await federated.resolve(google());
    const second = await federated.resolve(
      apple({ providerUserId: "apple-1", name: "Apple Person" }),
    );

    expect(second.id).toBe(first.id);
    const row = await accountRow(first.id);
    expect(row.roles.map((role) => role.role)).toEqual(["external"]);
    expect(row.identities.map((identity) => identity.provider).sort()).toEqual([
      "apple",
      "google",
    ]);
  });

  it("never changes the roles of an existing account on login", async () => {
    const email = testEmail("existing");
    const existing = await seedAccount(db, {
      role: "tutor",
      email,
      idType: "employee_id",
      identifier: "employee-7",
    });

    const user = await federated.resolve(google({ email }));

    expect(user.id).toBe(existing.id);
    expect(user.role).toBe("tutor");
    const row = await accountRow(existing.id);
    expect(row.roles.map((role) => role.role)).toEqual(["tutor"]);
    expect(row.identities).toHaveLength(1);
  });

  it("rejects locked, banned and inactive accounts with distinct codes", async () => {
    for (const [status, code] of [
      ["locked", "account-locked"],
      ["banned", "account-banned"],
      ["inactive", "account-inactive"],
    ] as const) {
      await truncateAll(db);
      const email = testEmail(status);
      await seedAccount(db, {
        role: "external",
        email,
        status,
        idType: "passport",
        identifier: `id-${status}`,
      });

      await expect(
        federated.resolve(google({ email, providerUserId: `google-${status}` })),
      ).rejects.toMatchObject({ code });
    }
  });

  it("does not match or revive a soft-deleted account", async () => {
    const admin = await seedAccount(db, { role: "tech_admin" });
    const email = testEmail("deleted");
    const created = await accounts.create(
      {
        email,
        name: "Deleted Person",
        idType: "passport",
        identifier: "deleted-1",
        password: TEST_PASSWORD,
        role: "external",
      },
      { id: admin.id, role: "tech_admin" },
    );
    await accounts.softDelete(created.id, {
      id: admin.id,
      role: "tech_admin",
    });

    const user = await federated.resolve(google({ email }));

    expect(user.id).not.toBe(created.id);
    const oldRow = await db.account.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(oldRow.deletedAt).not.toBeNull();
    expect(oldRow.email).not.toBe(email);
    const newRow = await accountRow(user.id);
    expect(newRow.email).toBe(email);
    expect(newRow.deletedAt).toBeNull();
  });

  it("links the provider identity to a new account after soft delete", async () => {
    const admin = await seedAccount(db, { role: "tech_admin" });
    const profile = google({
      email: testEmail("identity-deleted"),
      providerUserId: "google-deleted-identity",
    });
    const first = await federated.resolve(profile);
    await accounts.softDelete(first.id, {
      id: admin.id,
      role: "tech_admin",
    });

    const second = await federated.resolve(profile);

    expect(second.id).not.toBe(first.id);
    const identities = await db.accountIdentity.findMany({
      where: { provider: "google", providerUserId: profile.providerUserId },
    });
    expect(identities).toHaveLength(1);
    expect(identities[0]?.accountId).toBe(second.id);
    expect(await accountRow(first.id)).toMatchObject({ deletedAt: expect.any(Date) });
  });

  it("accepts an Apple private relay address and falls back to the email local part", async () => {
    const user = await federated.resolve(
      apple({
        email: "abc123@privaterelay.appleid.com",
        name: null,
        providerUserId: "apple-relay",
      }),
    );

    const row = await accountRow(user.id);
    expect(row.email).toBe("abc123@privaterelay.appleid.com");
    expect(row.name).toBe("abc123");
    expect(row.roles.map((role) => role.role)).toEqual(["external"]);
  });
});

describeDb("federated HTTP behaviour", () => {
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

  it("lists only enabled providers", async () => {
    const app = createApp({
      config,
      logger: createLogger(config),
      prisma: db,
    });
    const response = await request(app).get("/api/auth/providers").expect(200);
    expect(response.body.data.providers).toEqual([]);
  });

  it("returns 404 for a provider that is not configured", async () => {
    const app = createApp({
      config,
      logger: createLogger(config),
      prisma: db,
    });
    await request(app).get("/api/auth/google").expect(404);
  });

  it("never authenticates a federated account with a null password", async () => {
    const app = createApp({
      config,
      logger: createLogger(config),
      prisma: db,
    });
    const account = await seedAccount(db, {
      role: "student",
      password: null,
      idType: "account_number",
      identifier: "pending:null-password",
    });
    const agent = request.agent(app);
    const token = await csrfToken(agent);

    const response = await agent
      .post("/api/auth/login")
      .set("x-csrf-token", token)
      .send({ email: account.email, password: TEST_PASSWORD })
      .expect(401);

    expect(response.body.error.message).toBe("invalid-credentials");
  });

  it("logs only the provider, outcome and error code", async () => {
    const logs: string[] = [];
    const stream = { write: (line: string) => logs.push(line) };
    const googleConfig = loadConfig({
      NODE_ENV: "test",
      PORT: "3000",
      DATABASE_URL:
        testDatabaseUrl ?? "mysql://root:root@127.0.0.1:3306/app",
      SESSION_SECRET: "a".repeat(32),
      CORS_ORIGINS: "http://localhost:2173",
      LOG_LEVEL: "info",
      LOG_FORMAT: "json",
      GOOGLE_CLIENT_ID: "client",
      GOOGLE_CLIENT_SECRET: "secret",
      AUTH_FAILURE_REDIRECT: "/auth/login",
    });
    const app = createApp({
      config: googleConfig,
      logger: createLogger(googleConfig, stream),
      prisma: db,
    });

    const response = await request(app)
      .get("/api/auth/google/callback")
      .query({ state: "forged" })
      .expect(302);
    expect(response.headers.location).toBe(
      "/auth/login?error=invalid-state",
    );

    const federatedLogs = logs
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((entry) => entry.provider === "google");
    expect(federatedLogs).toHaveLength(1);
    expect(federatedLogs[0]).toMatchObject({
      provider: "google",
      outcome: "failure",
      errorCode: "invalid-state",
    });
    expect(logs.join("\n")).not.toMatch(
      /id_token|access_token|refresh_token|authorization/i,
    );
  });
});
