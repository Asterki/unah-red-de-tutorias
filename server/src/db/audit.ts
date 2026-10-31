import type { EntityType, Prisma } from "@prisma/client";

import type { TransactionClient } from "./tx.js";

export type AuditChanges = Record<string, unknown>;

/** Create the metadata row owned by a new resource. */
export function createMetadata(
  tx: TransactionClient,
  actorId: string | null,
): Promise<{ id: string }> {
  return tx.metadata.create({
    data: {
      createdBy: actorId,
      updatedBy: actorId,
    },
    select: { id: true },
  });
}

/** Append one business audit row. Callers must never place secrets in `changes`. */
export function appendHistory(
  tx: TransactionClient,
  metadataId: string,
  entityType: EntityType,
  entityId: string,
  actorId: string | null,
  changes: AuditChanges,
): Promise<{ id: string }> {
  return tx.metadataUpdateHistory.create({
    data: {
      metadataId,
      entityType,
      entityId,
      updatedById: actorId,
      changes: changes as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
}

/**
 * Record a soft delete.
 *
 * The caller updates the entity's own `deletedAt`/`deletedBy` and hashes its
 * unique natural keys in the same transaction; this helper only writes the
 * shared metadata/audit rows.
 */
export async function softDelete(
  tx: TransactionClient,
  metadataId: string,
  entityType: EntityType,
  entityId: string,
  actorId: string | null,
): Promise<void> {
  const deletedAt = new Date();

  await tx.metadata.update({
    where: { id: metadataId },
    data: { updatedBy: actorId },
  });

  await appendHistory(tx, metadataId, entityType, entityId, actorId, {
    deleted: true,
    deletedAt: deletedAt.toISOString(),
  });
}

/** Record a restore. Hashed unique keys are intentionally not recovered. */
export async function restore(
  tx: TransactionClient,
  metadataId: string,
  entityType: EntityType,
  entityId: string,
  actorId: string | null,
): Promise<void> {
  await tx.metadata.update({
    where: { id: metadataId },
    data: { updatedBy: actorId },
  });

  await appendHistory(tx, metadataId, entityType, entityId, actorId, {
    deleted: false,
    deletedAt: null,
  });
}
