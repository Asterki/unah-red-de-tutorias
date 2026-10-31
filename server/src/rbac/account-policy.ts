import type { AccountStatus, Role } from "@prisma/client";

import type { TransactionClient } from "../db/tx.js";
import { ConflictError, ForbiddenError } from "../http/errors.js";
import { canAssignRole, canManage } from "@unah-red-tutores/shared";

export type AdminChange = {
  role?: Role;
  status?: AccountStatus;
  deleted?: boolean;
};

const LAST_ADMIN_ROLE: Role = "tech_admin";

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
 * Reject a change that would remove the only active, non-deleted tech admin.
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
      roles: { select: { role: true } },
      status: true,
      deletedAt: true,
    },
  });

  const isLastAdminRole = target?.roles.some(
    (entry) => entry.role === LAST_ADMIN_ROLE,
  );

  if (
    !target ||
    !isLastAdminRole ||
    target.status !== "active" ||
    target.deletedAt !== null
  ) {
    return;
  }

  const remainsAdmin =
    (change.role === undefined || change.role === LAST_ADMIN_ROLE) &&
    (change.status === undefined || change.status === "active") &&
    change.deleted !== true;

  if (remainsAdmin) {
    return;
  }

  const admins = await tx.account.count({
    where: {
      status: "active",
      deletedAt: null,
      roles: { some: { role: LAST_ADMIN_ROLE } },
    },
  });

  if (admins <= 1) {
    throw new ConflictError("last-admin");
  }
}
