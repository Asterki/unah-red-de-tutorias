import type { RequestHandler } from "express";
import { ROLE_PERMISSIONS, ROLES } from "@unah-red-tutores/shared";

export const listRoles: RequestHandler = (_req, res) => {
  res.json({
    data: ROLES.map((role) => ({
      role,
      permissions: ROLE_PERMISSIONS[role],
    })),
  });
};
