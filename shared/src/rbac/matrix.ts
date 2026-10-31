import type { Permission } from "./permissions.js";
import { PERMISSIONS } from "./permissions.js";
import type { Role } from "./roles.js";

export const ROLE_PERMISSIONS = {
  tech_admin: [...PERMISSIONS],
  general_admin: [...PERMISSIONS],
  campus_admin: [
    "accounts:read",
    "accounts:update",
    "accounts:update-status",
    "accounts:change-password",
    "roles:read",
    "docs:read",
  ],
  tutor: ["docs:read"],
  student: ["docs:read"],
  external: ["docs:read"],
  observer: ["docs:read"],
} as const satisfies Record<Role, readonly Permission[]>;
