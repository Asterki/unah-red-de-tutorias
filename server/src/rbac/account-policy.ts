import type { AccountStatus, Role } from "@prisma/client";

import type { TransactionClient } from "../db/tx.js";
import { ConflictError, ForbiddenError } from "../http/errors.js";
import { canAssignRole, canManage } from "@unah-red-tutores/shared";

export type AdminChange = {
  role?: Role;
  status?: AccountStatus;
  deleted?: boolean;
};

export function assertCanManage(actor: Role, targetRole: Role): void {
  if (!canManage(actor, targetRole)) {
    throw new ForbiddenError("cannot-manage-account");
  }
}

export function assertCanAssign(actor: Role, newRole: Role): void {
  if (!canAssignRole(actor, newRole)) {
    throw new ForbiddenError("role-cannot-be-assigned");
  }
}

export function assertNotSelf(actorId: string, targetId: string): void {
  if (actorId === targetId) {
    throw new ConflictError("cannot-manage-self");
  }
}

/**
 * Reject a change that would remove the only active, non-deleted admin.
 * Must run inside the same transaction as the write.
 */
export async function assertNotLastAdmin(
  tx: TransactionClient,
  targetId: string,
  change: AdminChange,
): Promise<void> {
  const target = await tx.account.findUnique({
    where: { id: targetId },
    select: {
      role: true,
      status: true,
      metadata: { select: { deleted: true } },
    },
  });

  if (
    !target ||
    target.role !== "admin" ||
    target.status !== "active" ||
    target.metadata?.deleted === true
  ) {
    return;
  }

  const remainsAdmin =
    (change.role === undefined || change.role === "admin") &&
    (change.status === undefined || change.status === "active") &&
    change.deleted !== true;

  if (remainsAdmin) {
    return;
  }

  const admins = await tx.account.count({
    where: {
      role: "admin",
      status: "active",
      OR: [{ metadata: null }, { metadata: { is: { deleted: false } } }],
    },
  });

  if (admins <= 1) {
    throw new ConflictError("last-admin");
  }
}
