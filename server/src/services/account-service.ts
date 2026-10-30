import bcrypt from "bcrypt";
import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  AccountDto,
  CreateAccountRequest,
  ListAccountsQuery,
  Paginated,
  Role,
  UpdateAccountRequest,
} from "@unah-red-tutores/shared";

import {
  appendHistory,
  createMetadata,
  restore,
  softDelete,
} from "../db/audit.js";
import { runInTransaction, type TransactionClient } from "../db/tx.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../http/errors.js";
import { toAccountDto } from "../http/dto/accounts.js";
import { paginated, toPrismaPagination } from "../http/pagination.js";
import {
  assertCanAssign,
  assertCanManage,
  assertNotLastAdmin,
  assertNotSelf,
} from "../rbac/account-policy.js";

const BCRYPT_COST = 12;

export type AccountActor = {
  id: string;
  role: Role;
};

type AccountWithMetadata = Prisma.AccountGetPayload<{
  include: { metadata: true };
}>;

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function findAccount(
  tx: TransactionClient,
  id: string,
  options: { includeDeleted?: boolean } = {},
): Promise<AccountWithMetadata> {
  const account = await tx.account.findUnique({
    where: { id },
    include: { metadata: true },
  });

  if (
    !account ||
    (!options.includeDeleted && account.metadata?.deleted === true)
  ) {
    throw new NotFoundError("account-not-found");
  }

  return account;
}

async function metadataIdFor(
  tx: TransactionClient,
  account: AccountWithMetadata,
  actorId: string,
): Promise<string> {
  if (account.metadataId) {
    return account.metadataId;
  }
  const metadata = await createMetadata(tx, actorId);
  await tx.account.update({
    where: { id: account.id },
    data: { metadataId: metadata.id },
  });
  return metadata.id;
}

export function createAccountService(prisma: PrismaClient) {
  return {
    async list(input: ListAccountsQuery): Promise<Paginated<AccountDto>> {
      const where: Prisma.AccountWhereInput = {};

      if (!input.includeDeleted) {
        where.metadata = { is: { deleted: false } };
      }
      if (input.role) {
        where.role = input.role;
      }
      if (input.status) {
        where.status = input.status;
      }
      if (input.search) {
        where.OR = [
          { name: { contains: input.search } },
          { email: { contains: input.search } },
        ];
      }

      const { skip, take } = toPrismaPagination(input);
      const [accounts, total] = await prisma.$transaction([
        prisma.account.findMany({
          where,
          skip,
          take,
          orderBy: { name: "asc" },
          include: { metadata: true },
        }),
        prisma.account.count({ where }),
      ]);

      return paginated(accounts.map(toAccountDto), total, input);
    },

    async recordLogin(id: string): Promise<{ lastLogin: Date | null }> {
      return prisma.account.update({
        where: { id },
        data: { lastLogin: new Date() },
        select: { lastLogin: true },
      });
    },

    async get(id: string): Promise<AccountDto> {
      const account = await prisma.account.findUnique({
        where: { id },
        include: { metadata: true },
      });
      if (!account) {
        throw new NotFoundError("account-not-found");
      }
      return toAccountDto(account);
    },

    async create(
      input: CreateAccountRequest,
      actor: AccountActor,
    ): Promise<AccountDto> {
      assertCanAssign(actor.role, input.role);

      const email = input.email.trim().toLowerCase();
      const password = await bcrypt.hash(input.password, BCRYPT_COST);

      try {
        return await runInTransaction(prisma, async (tx) => {
          const metadata = await createMetadata(tx, actor.id);
          await appendHistory(tx, metadata.id, actor.id, {
            email,
            name: input.name,
            role: input.role,
            status: "active",
          });

          const account = await tx.account.create({
            data: {
              email,
              name: input.name,
              password,
              role: input.role,
              status: "active",
              mustChangePassword: true,
              metadataId: metadata.id,
            },
            include: { metadata: true },
          });

          return toAccountDto(account);
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictError("email-in-use");
        }
        throw error;
      }
    },

    async update(
      id: string,
      input: UpdateAccountRequest,
      actor: AccountActor,
    ): Promise<AccountDto> {
      try {
        return await runInTransaction(prisma, async (tx) => {
          const target = await findAccount(tx, id);
          assertCanManage(actor.role, target.role);

          const changes: Record<string, unknown> = {};
          const data: Prisma.AccountUpdateInput = {};

          if (input.email !== undefined) {
            const email = input.email.trim().toLowerCase();
            if (email !== target.email) {
              data.email = email;
              changes.email = { from: target.email, to: email };
            }
          }
          if (input.name !== undefined && input.name !== target.name) {
            data.name = input.name;
            changes.name = { from: target.name, to: input.name };
          }
          if (input.role !== undefined && input.role !== target.role) {
            assertCanAssign(actor.role, input.role);
            await assertNotLastAdmin(tx, target.id, { role: input.role });
            data.role = input.role;
            changes.role = { from: target.role, to: input.role };
          }

          if (Object.keys(changes).length === 0) {
            return toAccountDto(target);
          }

          const metadataId = await metadataIdFor(tx, target, actor.id);
          data.metadata = { update: { updatedBy: actor.id } };

          const updated = await tx.account.update({
            where: { id: target.id },
            data,
            include: { metadata: true },
          });

          await appendHistory(tx, metadataId, actor.id, changes);
          return toAccountDto(updated);
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictError("email-in-use");
        }
        throw error;
      }
    },

    async setStatus(
      id: string,
      status: "active" | "inactive",
      actor: AccountActor,
    ): Promise<AccountDto> {
      return runInTransaction(prisma, async (tx) => {
        const target = await findAccount(tx, id);
        assertCanManage(actor.role, target.role);
        await assertNotLastAdmin(tx, target.id, { status });

        const metadataId = await metadataIdFor(tx, target, actor.id);
        const updated = await tx.account.update({
          where: { id: target.id },
          data: {
            status,
            metadata: { update: { updatedBy: actor.id } },
          },
          include: { metadata: true },
        });

        await appendHistory(tx, metadataId, actor.id, {
          status: { from: target.status, to: status },
        });

        return toAccountDto(updated);
      });
    },

    async changeOwnPassword(
      id: string,
      currentPassword: string,
      newPassword: string,
    ): Promise<AccountDto> {
      const account = await prisma.account.findUnique({ where: { id } });
      if (!account) {
        throw new NotFoundError("account-not-found");
      }

      const valid = await bcrypt.compare(currentPassword, account.password);
      if (!valid) {
        throw new ValidationError("invalid-current-password");
      }

      const password = await bcrypt.hash(newPassword, BCRYPT_COST);

      return runInTransaction(prisma, async (tx) => {
        const current = await findAccount(tx, id);
        const metadataId = await metadataIdFor(tx, current, id);

        const updated = await tx.account.update({
          where: { id },
          data: {
            password,
            mustChangePassword: false,
            metadata: { update: { updatedBy: id } },
          },
          include: { metadata: true },
        });

        await appendHistory(tx, metadataId, id, {
          password: "[changed]",
          mustChangePassword: false,
        });

        return toAccountDto(updated);
      });
    },

    async setPassword(
      id: string,
      newPassword: string,
      actor: AccountActor,
    ): Promise<AccountDto> {
      const target = await prisma.account.findUnique({ where: { id } });
      if (!target) {
        throw new NotFoundError("account-not-found");
      }
      assertNotSelf(actor.id, target.id);
      assertCanManage(actor.role, target.role);

      const password = await bcrypt.hash(newPassword, BCRYPT_COST);

      return runInTransaction(prisma, async (tx) => {
        const current = await findAccount(tx, id);
        const metadataId = await metadataIdFor(tx, current, actor.id);

        const updated = await tx.account.update({
          where: { id },
          data: {
            password,
            mustChangePassword: true,
            metadata: { update: { updatedBy: actor.id } },
          },
          include: { metadata: true },
        });

        await appendHistory(tx, metadataId, actor.id, {
          password: "[changed]",
          mustChangePassword: true,
        });

        return toAccountDto(updated);
      });
    },

    async softDelete(id: string, actor: AccountActor): Promise<AccountDto> {
      return runInTransaction(prisma, async (tx) => {
        const target = await findAccount(tx, id);
        assertNotSelf(actor.id, target.id);
        assertCanManage(actor.role, target.role);
        await assertNotLastAdmin(tx, target.id, { deleted: true });

        const metadataId = await metadataIdFor(tx, target, actor.id);
        await softDelete(tx, metadataId, actor.id);

        const tombstone = `deleted+${target.id}@invalid`;
        const updated = await tx.account.update({
          where: { id: target.id },
          data: {
            email: tombstone,
            metadata: { update: { updatedBy: actor.id } },
          },
          include: { metadata: true },
        });

        await appendHistory(tx, metadataId, actor.id, {
          email: { from: target.email, to: tombstone },
        });

        return toAccountDto(updated);
      });
    },

    async restore(id: string, actor: AccountActor): Promise<AccountDto> {
      try {
        return await runInTransaction(prisma, async (tx) => {
          const target = await findAccount(tx, id, { includeDeleted: true });
          if (target.metadata?.deleted !== true) {
            throw new NotFoundError("account-not-found");
          }
          assertCanManage(actor.role, target.role);

          const metadataId = target.metadataId ?? target.metadata?.id;
          if (!metadataId) {
            throw new NotFoundError("account-not-found");
          }

          const history = await tx.metadataUpdateHistory.findMany({
            where: { metadataId },
            orderBy: { updatedAt: "desc" },
          });

          let originalEmail: string | undefined;
          for (const row of history) {
            const changes = row.changes as {
              email?: { from?: string; to?: string };
            };
            if (
              changes.email?.from &&
              changes.email.to === target.email &&
              changes.email.from !== target.email
            ) {
              originalEmail = changes.email.from;
              break;
            }
          }

          await restore(tx, metadataId, actor.id);

          const data: Prisma.AccountUpdateInput = {
            metadata: { update: { updatedBy: actor.id } },
          };
          if (originalEmail && originalEmail !== target.email) {
            data.email = originalEmail;
          }

          const updated = await tx.account.update({
            where: { id: target.id },
            data,
            include: { metadata: true },
          });

          await appendHistory(tx, metadataId, actor.id, {
            deleted: false,
            ...(originalEmail && originalEmail !== target.email
              ? { email: { from: target.email, to: originalEmail } }
              : {}),
          });

          return toAccountDto(updated);
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictError("email-in-use");
        }
        throw error;
      }
    },
  };
}

export type AccountService = ReturnType<typeof createAccountService>;
