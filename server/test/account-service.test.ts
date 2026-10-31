import { listAccountsQuerySchema } from "@unah-red-tutores/shared";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { assertNotLastAdmin } from "../src/rbac/account-policy.js";
import { runInTransaction } from "../src/db/tx.js";
import { createAccountService } from "../src/services/account-service.js";
import {
  createTestPrisma,
  hasTestDatabase,
  migrateTestDatabase,
  seedAccount,
  testEmail,
  truncateAll,
} from "./helpers/db.js";

const describeDb = hasTestDatabase ? describe : describe.skip;
const db = (hasTestDatabase ? createTestPrisma() : null) as PrismaClient;
const service = createAccountService(db, {
  softDeleteHashKey: "test-soft-delete-hash-key",
});

async function historyFor(accountId: string) {
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { metadataId: true },
  });
  return db.metadataUpdateHistory.findMany({
    where: { metadataId: account?.metadataId ?? "" },
  });
}

describeDb("account service", () => {
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

  it("a general admin cannot manage another general admin or a tech admin", async () => {
    const actor = await seedAccount(db, { role: "general_admin" });
    const peer = await seedAccount(db, { role: "general_admin" });
    const tech = await seedAccount(db, { role: "tech_admin" });
    const tutor = await seedAccount(db, { role: "tutor" });
    const generalActor = { id: actor.id, role: "general_admin" as const };

    await expect(
      service.update(peer.id, { name: "Nope" }, generalActor),
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      service.update(tech.id, { name: "Nope" }, generalActor),
    ).rejects.toMatchObject({ status: 403 });

    const updated = await service.update(
      tutor.id,
      { name: "Managed" },
      generalActor,
    );
    expect(updated.name).toBe("Managed");
  });

  it("rejects self-deletion", async () => {
    const admin = await seedAccount(db, { role: "tech_admin" });

    await expect(
      service.softDelete(admin.id, { id: admin.id, role: "tech_admin" }),
    ).rejects.toMatchObject({ status: 409, message: "cannot-manage-self" });
  });

  it("a tech admin cannot manage another tech admin", async () => {
    const actor = await seedAccount(db, { role: "tech_admin" });
    const other = await seedAccount(db, { role: "tech_admin" });
    const adminActor = { id: actor.id, role: "tech_admin" as const };

    await expect(
      service.softDelete(other.id, adminActor),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.update(other.id, { role: "tutor" }, adminActor),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.setStatus(other.id, "inactive", adminActor),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("refuses to delete, demote or deactivate the last tech admin", async () => {
    const admin = await seedAccount(db, { role: "tech_admin" });

    await expect(
      runInTransaction(db, (tx) =>
        assertNotLastAdmin(tx, admin.id, { deleted: true }),
      ),
    ).rejects.toMatchObject({ status: 409, message: "last-admin" });

    await expect(
      runInTransaction(db, (tx) =>
        assertNotLastAdmin(tx, admin.id, { role: "tutor" }),
      ),
    ).rejects.toMatchObject({ status: 409, message: "last-admin" });

    await expect(
      runInTransaction(db, (tx) =>
        assertNotLastAdmin(tx, admin.id, { status: "inactive" }),
      ),
    ).rejects.toMatchObject({ status: 409, message: "last-admin" });
  });

  it("allows removing a tech admin while another active tech admin remains", async () => {
    const first = await seedAccount(db, { role: "tech_admin" });
    const second = await seedAccount(db, { role: "tech_admin" });

    await expect(
      runInTransaction(db, (tx) =>
        assertNotLastAdmin(tx, first.id, { deleted: true }),
      ),
    ).resolves.toBeUndefined();

    await db.account.delete({ where: { id: first.id } });

    await expect(
      runInTransaction(db, (tx) =>
        assertNotLastAdmin(tx, second.id, { deleted: true }),
      ),
    ).rejects.toMatchObject({ status: 409, message: "last-admin" });
  });

  it("writes an audit row for every mutation without storing secrets", async () => {
    const admin = await seedAccount(db, { role: "tech_admin" });
    const actor = { id: admin.id, role: "tech_admin" as const };
    const createdPassword = "CreatedPassword123!";

    const created = await service.create(
      {
        email: testEmail("audit"),
        name: "Audit Target",
        idType: "employee_id",
        identifier: "EMP-9001",
        password: createdPassword,
        role: "campus_admin",
      },
      actor,
    );

    expect(await historyFor(created.id)).toHaveLength(1);

    await service.update(created.id, { name: "Renamed" }, actor);
    expect(await historyFor(created.id)).toHaveLength(2);

    await service.setStatus(created.id, "inactive", actor);
    expect(await historyFor(created.id)).toHaveLength(3);

    const newPassword = "SuperSecret12345!";
    await service.setPassword(created.id, newPassword, actor);
    expect(await historyFor(created.id)).toHaveLength(4);

    await service.softDelete(created.id, actor);
    const afterDelete = await historyFor(created.id);
    expect(afterDelete.length).toBeGreaterThan(4);

    await service.restore(created.id, actor);
    const afterRestore = await historyFor(created.id);
    expect(afterRestore.length).toBeGreaterThan(afterDelete.length);

    const serialized = JSON.stringify(afterRestore);
    expect(serialized).not.toContain(createdPassword);
    expect(serialized).not.toContain(newPassword);
    expect(serialized).not.toMatch(/\$2[aby]\$/);
  });

  it("hashes unique keys on soft delete so they can be reused", async () => {
    const admin = await seedAccount(db, { role: "tech_admin" });
    const email = testEmail("reusable");
    const actor = { id: admin.id, role: "tech_admin" as const };

    const created = await service.create(
      {
        email,
        name: "First",
        idType: "passport",
        identifier: "P-100",
        password: "FirstPassword123!",
        role: "external",
      },
      actor,
    );

    await service.softDelete(created.id, actor);
    const deleted = await db.account.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(deleted.deletedAt).not.toBeNull();
    expect(deleted.deletedBy).toBe(admin.id);
    expect(deleted.email).toMatch(/^del:[a-f0-9]{64}$/);
    expect(deleted.email).not.toContain(email);
    expect(deleted.identifier).toMatch(/^del:[a-f0-9]{64}$/);

    const reused = await service.create(
      {
        email,
        name: "Second",
        idType: "passport",
        identifier: "P-100",
        password: "SecondPassword123!",
        role: "external",
      },
      actor,
    );
    expect(reused.email).toBe(email);
  });

  it("maps duplicate emails to a conflict", async () => {
    const admin = await seedAccount(db, { role: "tech_admin" });
    const email = testEmail("duplicate");
    const actor = { id: admin.id, role: "tech_admin" as const };

    await service.create(
      {
        email,
        name: "First",
        idType: "account_number",
        identifier: "A-1",
        password: "FirstPassword123!",
        role: "tutor",
      },
      actor,
    );

    await expect(
      service.create(
        {
          email,
          name: "Second",
          idType: "account_number",
          identifier: "A-2",
          password: "SecondPassword123!",
          role: "tutor",
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 409, message: "email-in-use" });
  });

  it("lists accounts with 1-based pagination metadata", async () => {
    await seedAccount(db, { role: "tutor", name: "A" });
    await seedAccount(db, { role: "tutor", name: "B" });
    await seedAccount(db, { role: "tutor", name: "C" });

    const first = await service.list({ page: 1, pageSize: 2 });
    expect(first.data).toHaveLength(2);
    expect(first.meta).toEqual({ page: 1, pageSize: 2, total: 3 });
    expect((first.data[0] as unknown as { password?: string }).password).toBeUndefined();

    const second = await service.list({ page: 2, pageSize: 2 });
    expect(second.data).toHaveLength(1);
  });

  it("rejects pageSize 1000 in the shared schema", () => {
    expect(
      listAccountsQuerySchema.safeParse({ pageSize: "1000" }).success,
    ).toBe(false);
  });
});
