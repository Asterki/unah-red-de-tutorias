import type { Account, AccountRole } from "@prisma/client";
import type { Role } from "@unah-red-tutores/shared";

declare global {
  namespace Express {
    interface User extends Account {
      roles: AccountRole[];
      /** Strongest role, derived from `roles` when the session is loaded. */
      role: Role;
    }
  }
}

export {};
