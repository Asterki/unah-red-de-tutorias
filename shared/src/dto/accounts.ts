import type { Permission } from "../rbac/permissions.js";
import type { Role } from "../rbac/roles.js";

export const ACCOUNT_STATUSES = [
  "active",
  "locked",
  "banned",
  "inactive",
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ID_TYPES = [
  "account_number",
  "employee_id",
  "national_id",
  "passport",
] as const;
export type IdType = (typeof ID_TYPES)[number];

export type AccountDto = {
  id: string;
  email: string;
  name: string;
  idType: IdType;
  identifier: string;
  role: Role;
  status: AccountStatus;
  mustChangePassword: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
};

export type SessionAccountDto = {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions: Permission[];
  status: AccountStatus;
  mustChangePassword: boolean;
  lastLogin: string | null;
};

export type RolePermissionsEntry = {
  role: Role;
  permissions: readonly Permission[];
};
