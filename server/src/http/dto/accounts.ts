import {
  ROLE_PERMISSIONS,
  type AccountDto,
  type AccountStatus,
  type IdType,
  type Role,
  type SessionAccountDto,
} from "@unah-red-tutores/shared";

import { primaryRole } from "../../rbac/primary-role.js";

type AccountRecord = {
  id: string;
  email: string;
  name: string;
  idType: IdType;
  identifier: string;
  status: AccountStatus;
  mustChangePassword: boolean;
  lastLogin: Date | null;
  deletedAt: Date | null;
  roles: Array<{ role: Role }>;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/** Map a database row to the public account shape. Never include the hash. */
export function toAccountDto(account: AccountRecord): AccountDto {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    idType: account.idType,
    identifier: account.identifier,
    role: primaryRole(account.roles),
    status: account.status,
    mustChangePassword: account.mustChangePassword,
    lastLogin: iso(account.lastLogin),
    createdAt:
      account.metadata?.createdAt.toISOString() ?? new Date(0).toISOString(),
    updatedAt:
      account.metadata?.updatedAt.toISOString() ?? new Date(0).toISOString(),
    deleted: account.deletedAt !== null,
  };
}

type SessionAccountRecord = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: AccountStatus;
  mustChangePassword: boolean;
  lastLogin: Date | string | null;
};

export function toSessionAccountDto(
  account: SessionAccountRecord,
): SessionAccountDto {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
    permissions: [...ROLE_PERMISSIONS[account.role]],
    status: account.status,
    mustChangePassword: account.mustChangePassword,
    lastLogin:
      account.lastLogin instanceof Date
        ? account.lastLogin.toISOString()
        : account.lastLogin,
  };
}
