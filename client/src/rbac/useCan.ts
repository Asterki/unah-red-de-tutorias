import { useSelector } from "react-redux";
import type { Permission } from "@unah-red-tutores/shared";

import type { RootState } from "../store";
import { can, canManage } from "./can";

export function useCan() {
  const role = useSelector((state: RootState) => state.auth.account?.role);

  return {
    role,
    can: (permission: Permission) => can(role, permission),
    canManage: (target: Parameters<typeof canManage>[1]) =>
      canManage(role, target),
  };
}
