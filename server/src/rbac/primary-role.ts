import { ROLE_RANK, type Role } from "@unah-red-tutores/shared";

/** Collapse the many-to-many roles into the strongest role for the API. */
export function primaryRole(roles: ReadonlyArray<{ role: Role }>): Role {
  const first = roles[0];
  if (!first) {
    throw new Error("Account has no role");
  }
  return roles.reduce(
    (strongest, entry) =>
      ROLE_RANK[entry.role] < ROLE_RANK[strongest] ? entry.role : strongest,
    first.role,
  );
}
