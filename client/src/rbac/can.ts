import {
  canManage as sharedCanManage,
  roleHasPermission,
  type Permission,
  type Role,
} from "@unah-red-tutores/shared";

export function can(
  role: Role | null | undefined,
  permission: Permission,
): boolean {
  return role ? roleHasPermission(role, permission) : false;
}

export function canManage(
  actor: Role | null | undefined,
  target: Role,
): boolean {
  return actor ? sharedCanManage(actor, target) : false;
}
