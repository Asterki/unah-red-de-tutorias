import { useEffect } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { App } from "antd";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import type { Permission } from "@unah-red-tutores/shared";

import type { RootState } from "../store";
import { can } from "./can";

type RequirePermissionProps = {
  permission: Permission;
  children: ReactNode;
};

/**
 * Route guard for a single permission. Unauthorised users see a localised
 * message and are sent back to the dashboard.
 */
export function RequirePermission({
  permission,
  children,
}: RequirePermissionProps) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { t } = useTranslation("errors");
  const account = useSelector((state: RootState) => state.auth.account);
  const allowed = can(account?.role, permission);

  useEffect(() => {
    if (account && !allowed) {
      message.error(t("codes.forbidden"));
      navigate({ to: "/admin" });
    }
  }, [account, allowed, message, navigate, t]);

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
