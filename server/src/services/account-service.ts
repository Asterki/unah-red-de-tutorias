import bcrypt from "bcrypt";
import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  AccountDto,
  CreateAccountRequest,
  IdType,
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
import { hashUniqueValue } from "../db/soft-delete.js";
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
import { primaryRole } from "../rbac/primary-role.js";

const BCRYPT_COST = 12;

export type AccountActor = {
  id: string;
  role: Role;
};

export type AccountServiceOptions = {
  softDeleteHashKey: string;
};

type AccountWithRelations = Prisma.AccountGetPayload<{
  include: { metadata: true; roles: true };
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
): Promise<AccountWithRelations> {
  const account = await tx.account.findUnique({
    where: { id },
    include: { metadata: true, roles: true },
  });

  if (!account || (!options.includeDeleted && account.deletedAt !== null)) {
    throw new NotFoundError("account-not-found");
  }

  return account;
}

export function createAccountService(
  prisma: PrismaClient,
  { softDeleteHashKey }: AccountServiceOptions,
) {
  return {
    async list(input: ListAccountsQuery): Promise<Paginated<AccountDto>> {
      const where: Prisma.AccountWhereInput = {};

      if (!input.includeDeleted) {
        where.deletedAt = null;
      }
      if (input.role) {
        where.roles = { some: { role: input.role } };
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
          include: { metadata: true, roles: true },
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
        include: { metadata: true, roles: true },
      });
      if (!account || account.deletedAt !== null) {
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
      const identifier = input.identifier.trim();
      const password = await bcrypt.hash(input.password, BCRYPT_COST);

      try {
        return await runInTransaction(prisma, async (tx) => {
          const metadata = await createMetadata(tx, actor.id);

          const account = await tx.account.create({
            data: {
              email,
              name: input.name,
              idType: input.idType,
              identifier,
              password,
              status: "active",
              mustChangePassword: true,
              metadataId: metadata.id,
              roles: { create: { role: input.role } },
            },
            include: { metadata: true, roles: true },
          });

          await appendHistory(
            tx,
            metadata.id,
            "account",
            account.id,
            actor.id,
            {
              email,
              name: input.name,
              idType: input.idType,
              role: input.role,
              status: "active",
            },
          );

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
          const targetRole = primaryRole(target.roles);
          assertCanManage(actor.role, targetRole);

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
          if (input.idType !== undefined && input.idType !== target.idType) {
            data.idType = input.idType;
            changes.idType = { from: target.idType, to: input.idType };
          }
          if (
            input.identifier !== undefined &&
            input.identifier.trim() !== target.identifier
          ) {
            data.identifier = input.identifier.trim();
            changes.identifier = { from: target.identifier, to: input.identifier };
          }
          if (input.role !== undefined && input.role !== targetRole) {
            assertCanAssign(actor.role, input.role);
            await assertNotLastAdmin(tx, target.id, { role: input.role });
            data.roles = {
              deleteMany: {},
              create: { role: input.role },
            };
            changes.role = { from: targetRole, to: input.role };
          }

          if (Object.keys(changes).length === 0) {
            return toAccountDto(target);
          }

          data.metadata = { update: { updatedBy: actor.id } };

          const updated = await tx.account.update({
            where: { id: target.id },
            data,
            include: { metadata: true, roles: true },
          });

          await appendHistory(
            tx,
            target.metadataId,
            "account",
            target.id,
            actor.id,
            changes,
          );
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
        assertCanManage(actor.role, primaryRole(target.roles));
        await assertNotLastAdmin(tx, target.id, { status });

        const updated = await tx.account.update({
          where: { id: target.id },
          data: {
            status,
            metadata: { update: { updatedBy: actor.id } },
          },
          include: { metadata: true, roles: true },
        });

        await appendHistory(
          tx,
          target.metadataId,
          "account",
          target.id,
          actor.id,
          { status: { from: target.status, to: status } },
        );

        return toAccountDto(updated);
      });
    },

    async changeOwnPassword(
      id: string,
      currentPassword: string,
      newPassword: string,
    ): Promise<AccountDto> {
      const account = await prisma.account.findUnique({ where: { id } });
      if (!account || account.deletedAt !== null) {
        throw new NotFoundError("account-not-found");
      }
      if (!account.password) {
        throw new ValidationError("password-login-unavailable");
      }

      const valid = await bcrypt.compare(currentPassword, account.password);
      if (!valid) {
        throw new ValidationError("invalid-current-password");
      }

      const password = await bcrypt.hash(newPassword, BCRYPT_COST);

      return runInTransaction(prisma, async (tx) => {
        const current = await findAccount(tx, id);

        const updated = await tx.account.update({
          where: { id },
          data: {
            password,
            mustChangePassword: false,
            metadata: { update: { updatedBy: id } },
          },
          include: { metadata: true, roles: true },
        });

        await appendHistory(
          tx,
          current.metadataId,
          "account",
          id,
          id,
          { password: "[changed]", mustChangePassword: false },
        );

        return toAccountDto(updated);
      });
    },

    async setPassword(
      id: string,
      newPassword: string,
      actor: AccountActor,
    ): Promise<AccountDto> {
      const target = await prisma.account.findUnique({
        where: { id },
        include: { roles: true },
      });
      if (!target || target.deletedAt !== null) {
        throw new NotFoundError("account-not-found");
      }
      assertNotSelf(actor.id, target.id);
      assertCanManage(actor.role, primaryRole(target.roles));

      const password = await bcrypt.hash(newPassword, BCRYPT_COST);

      return runInTransaction(prisma, async (tx) => {
        const current = await findAccount(tx, id);

        const updated = await tx.account.update({
          where: { id },
          data: {
            password,
            mustChangePassword: true,
            metadata: { update: { updatedBy: actor.id } },
          },
          include: { metadata: true, roles: true },
        });

        await appendHistory(
          tx,
          current.metadataId,
          "account",
          target.id,
          actor.id,
          { password: "[changed]", mustChangePassword: true },
        );

        return toAccountDto(updated);
      });
    },

    async softDelete(id: string, actor: AccountActor): Promise<AccountDto> {
      return runInTransaction(prisma, async (tx) => {
        const target = await findAccount(tx, id);
        assertNotSelf(actor.id, target.id);
        assertCanManage(actor.role, primaryRole(target.roles));
        await assertNotLastAdmin(tx, target.id, { deleted: true });

        await softDelete(
          tx,
          target.metadataId,
          "account",
          target.id,
          actor.id,
        );

        const updated = await tx.account.update({
          where: { id: target.id },
          data: {
            email: hashUniqueValue(
              softDeleteHashKey,
              "email",
              target.id,
              target.email,
            ),
            identifier: hashUniqueValue(
              softDeleteHashKey,
              "identifier",
              target.id,
              target.identifier,
            ),
            deletedAt: new Date(),
            deletedBy: actor.id,
            metadata: { update: { updatedBy: actor.id } },
          },
          include: { metadata: true, roles: true },
        });

        return toAccountDto(updated);
      });
    },

    async restore(id: string, actor: AccountActor): Promise<AccountDto> {
      try {
        return await runInTransaction(prisma, async (tx) => {
          const target = await findAccount(tx, id, { includeDeleted: true });
          if (target.deletedAt === null) {
            throw new NotFoundError("account-not-found");
          }
          assertCanManage(actor.role, primaryRole(target.roles));

          await restore(
            tx,
            target.metadataId,
            "account",
            target.id,
            actor.id,
          );

          const updated = await tx.account.update({
            where: { id: target.id },
            data: {
              deletedAt: null,
              deletedBy: null,
              metadata: { update: { updatedBy: actor.id } },
            },
            include: { metadata: true, roles: true },
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

/** Identifier type used for placeholder identifiers on federated accounts. */
export const ID_TYPE_FOR_ROLE: Record<
  Extract<Role, "student" | "observer" | "external">,
  IdType
> = {
  student: "account_number",
  observer: "employee_id",
  external: "passport",
};
