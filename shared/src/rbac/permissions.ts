export const PERMISSIONS = [
  "accounts:read",
  "accounts:create",
  "accounts:update",
  "accounts:update-status",
  "accounts:change-password",
  "accounts:delete",
  "accounts:restore",
  "roles:read",
  "docs:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: unknown): value is Permission {
  return (
    typeof value === "string" &&
    (PERMISSIONS as readonly string[]).includes(value)
  );
}
