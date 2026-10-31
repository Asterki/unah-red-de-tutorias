import type { Role } from "@unah-red-tutores/shared";

import { primaryRole } from "../rbac/primary-role.js";

/**
 * Attach the strongest role to a Prisma account so Express/Passport consumers
 * can read `req.user.role` without querying `AccountRole` again.
 */
export function withPrimaryRole<
  T extends { roles: Array<{ role: Role }> },
>(account: T): T & { role: Role } {
  return { ...account, role: primaryRole(account.roles) };
}
