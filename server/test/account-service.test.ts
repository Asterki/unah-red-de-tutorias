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
const service = createAccountService(db);

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

  it("manager cannot manage another manager or an admin", async () => {
    const actor = await seedAccount(db, { role: "manager" });
    const peer = await seedAccount(db, { role: "manager" });
    const admin = await seedAccount(db, { role: "admin" });
    const staff = await seedAccount(db, { role: "staff" });
    const managerActor = { id: actor.id, role: "manager" as const };

    await expect(
      service.update(peer.id, { name: "Nope" }, managerActor),
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      service.update(admin.id, { name: "Nope" }, managerActor),
    ).rejects.toMatchObject({ status: 403 });

    const updated = await service.update(
      staff.id,
      { name: "Managed" },
      managerActor,
    );
    expect(updated.name).toBe("Managed");
  });

  it("rejects self-deletion", async () => {
    const admin = await seedAccount(db, { role: "admin" });

    await expect(
      service.softDelete(admin.id, { id: admin.id, role: "admin" }),
    ).rejects.toMatchObject({ status: 409, message: "cannot-manage-self" });
  });

  it("an admin cannot manage another admin", async () => {
    const actor = await seedAccount(db, { role: "admin" });
    const other = await seedAccount(db, { role: "admin" });
    const adminActor = { id: actor.id, role: "admin" as const };

    await expect(
      service.softDelete(other.id, adminActor),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.update(other.id, { role: "staff" }, adminActor),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.setStatus(other.id, "inactive", adminActor),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("refuses to delete, demote or deactivate the last admin", async () => {
    const admin = await seedAccount(db, { role: "admin" });

    await expect(
      runInTransaction(db, (tx) =>
        assertNotLastAdmin(tx, admin.id, { deleted: true }),
      ),
    ).rejects.toMatchObject({ status: 409, message: "last-admin" });

    await expect(
      runInTransaction(db, (tx) =>
        assertNotLastAdmin(tx, admin.id, { role: "staff" }),
      ),
    ).rejects.toMatchObject({ status: 409, message: "last-admin" });

    await expect(
      runInTransaction(db, (tx) =>
        assertNotLastAdmin(tx, admin.id, { status: "inactive" }),
      ),
    ).rejects.toMatchObject({ status: 409, message: "last-admin" });
  });

  it("allows removing an admin while another active admin remains", async () => {
    const first = await seedAccount(db, { role: "admin" });
    const second = await seedAccount(db, { role: "admin" });

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
    const admin = await seedAccount(db, { role: "admin" });
    const actor = { id: admin.id, role: "admin" as const };
    const createdPassword = "CreatedPassword123!";

    const created = await service.create(
      {
        email: testEmail("audit"),
        name: "Audit Target",
        password: createdPassword,
        role: "manager",
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

  it("maps duplicate emails to a conflict", async () => {
    const admin = await seedAccount(db, { role: "admin" });
    const email = testEmail("duplicate");
    const actor = { id: admin.id, role: "admin" as const };

    await service.create(
      { email, name: "First", password: "FirstPassword123!", role: "staff" },
      actor,
    );

    await expect(
      service.create(
        {
          email,
          name: "Second",
          password: "SecondPassword123!",
          role: "staff",
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 409, message: "email-in-use" });
  });

  it("lists accounts with 1-based pagination metadata", async () => {
    await seedAccount(db, { role: "staff", name: "A" });
    await seedAccount(db, { role: "staff", name: "B" });
    await seedAccount(db, { role: "staff", name: "C" });

    const first = await service.list({ page: 1, pageSize: 2 });
    expect(first.data).toHaveLength(2);
    expect(first.meta).toEqual({ page: 1, pageSize: 2, total: 3 });
    expect(first.data[0]?.password).toBeUndefined();

    const second = await service.list({ page: 2, pageSize: 2 });
    expect(second.data).toHaveLength(1);
  });

  it("rejects pageSize 1000 in the shared schema", () => {
    expect(
      listAccountsQuerySchema.safeParse({ pageSize: "1000" }).success,
    ).toBe(false);
  });
});
