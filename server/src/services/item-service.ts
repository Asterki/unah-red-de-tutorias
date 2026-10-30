import { Prisma, type PrismaClient } from "@prisma/client";
import {
  roleHasPermission,
  type CreateItemRequest,
  type ItemDto,
  type ListItemsQuery,
  type Paginated,
  type Role,
  type UpdateItemRequest,
} from "@unah-red-tutores/shared";

import {
  appendHistory,
  createMetadata,
  restore,
  softDelete,
} from "../db/audit.js";
import { runInTransaction, type TransactionClient } from "../db/tx.js";
import { NotFoundError } from "../http/errors.js";
import { toItemDto } from "../http/dto/items.js";
import { paginated, toPrismaPagination } from "../http/pagination.js";

export type ItemActor = {
  id: string;
  role: Role;
};

type ItemWithMetadata = Prisma.ItemGetPayload<{
  include: { metadata: true };
}>;

async function findItem(
  tx: TransactionClient,
  id: string,
  options: { includeDeleted?: boolean } = {},
): Promise<ItemWithMetadata> {
  const item = await tx.item.findUnique({
    where: { id },
    include: { metadata: true },
  });

  if (!item || (!options.includeDeleted && item.metadata?.deleted === true)) {
    throw new NotFoundError("item-not-found");
  }

  return item;
}

async function metadataIdFor(
  tx: TransactionClient,
  item: ItemWithMetadata,
  actorId: string,
): Promise<string> {
  if (item.metadataId) {
    return item.metadataId;
  }
  const metadata = await createMetadata(tx, actorId);
  await tx.item.update({
    where: { id: item.id },
    data: { metadataId: metadata.id },
  });
  return metadata.id;
}

export function createItemService(prisma: PrismaClient) {
  return {
    async list(
      input: ListItemsQuery,
      actor: ItemActor,
    ): Promise<Paginated<ItemDto>> {
      const includeDeleted =
        input.includeDeleted === true &&
        roleHasPermission(actor.role, "items:restore");

      const where: Prisma.ItemWhereInput = {};
      if (!includeDeleted) {
        where.metadata = { is: { deleted: false } };
      }
      if (input.status) {
        where.status = input.status;
      }
      if (input.q) {
        where.name = { contains: input.q };
      }

      const { skip, take } = toPrismaPagination(input);
      const [items, total] = await prisma.$transaction([
        prisma.item.findMany({
          where,
          skip,
          take,
          orderBy: { name: "asc" },
          include: { metadata: true },
        }),
        prisma.item.count({ where }),
      ]);

      return paginated(items.map(toItemDto), total, input);
    },

    async get(id: string): Promise<ItemDto> {
      const item = await prisma.item.findUnique({
        where: { id },
        include: { metadata: true },
      });
      if (!item || item.metadata?.deleted === true) {
        throw new NotFoundError("item-not-found");
      }
      return toItemDto(item);
    },

    async create(input: CreateItemRequest, actor: ItemActor): Promise<ItemDto> {
      return runInTransaction(prisma, async (tx) => {
        const metadata = await createMetadata(tx, actor.id);
        const name = input.name.trim();
        const description = input.description ?? null;

        await appendHistory(tx, metadata.id, actor.id, {
          name,
          description,
          status: "active",
        });

        const item = await tx.item.create({
          data: {
            name,
            description,
            status: "active",
            metadataId: metadata.id,
          },
          include: { metadata: true },
        });

        return toItemDto(item);
      });
    },

    async update(
      id: string,
      input: UpdateItemRequest,
      actor: ItemActor,
    ): Promise<ItemDto> {
      return runInTransaction(prisma, async (tx) => {
        const target = await findItem(tx, id);

        const changes: Record<string, unknown> = {};
        const data: Prisma.ItemUpdateInput = {};

        if (input.name !== undefined) {
          const name = input.name.trim();
          if (name !== target.name) {
            data.name = name;
            changes.name = { from: target.name, to: name };
          }
        }
        if (
          input.description !== undefined &&
          input.description !== target.description
        ) {
          data.description = input.description;
          changes.description = {
            from: target.description,
            to: input.description,
          };
        }
        if (input.status !== undefined && input.status !== target.status) {
          data.status = input.status;
          changes.status = { from: target.status, to: input.status };
        }

        if (Object.keys(changes).length === 0) {
          return toItemDto(target);
        }

        const metadataId = await metadataIdFor(tx, target, actor.id);
        data.metadata = { update: { updatedBy: actor.id } };

        const updated = await tx.item.update({
          where: { id: target.id },
          data,
          include: { metadata: true },
        });

        await appendHistory(tx, metadataId, actor.id, changes);
        return toItemDto(updated);
      });
    },

    async softDelete(id: string, actor: ItemActor): Promise<ItemDto> {
      return runInTransaction(prisma, async (tx) => {
        const target = await findItem(tx, id);
        const metadataId = await metadataIdFor(tx, target, actor.id);

        await softDelete(tx, metadataId, actor.id);

        const updated = await tx.item.findUniqueOrThrow({
          where: { id: target.id },
          include: { metadata: true },
        });
        return toItemDto(updated);
      });
    },

    async restore(id: string, actor: ItemActor): Promise<ItemDto> {
      return runInTransaction(prisma, async (tx) => {
        const target = await findItem(tx, id, { includeDeleted: true });
        if (target.metadata?.deleted !== true) {
          throw new NotFoundError("item-not-found");
        }

        const metadataId = target.metadataId ?? target.metadata?.id;
        if (!metadataId) {
          throw new NotFoundError("item-not-found");
        }

        await restore(tx, metadataId, actor.id);

        const updated = await tx.item.update({
          where: { id: target.id },
          data: { metadata: { update: { updatedBy: actor.id } } },
          include: { metadata: true },
        });
        return toItemDto(updated);
      });
    },
  };
}

export type ItemService = ReturnType<typeof createItemService>;
