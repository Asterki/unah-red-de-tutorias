import type { RequestHandler } from "express";
import { roleHasPermission, type Permission } from "@unah-red-tutores/shared";

import { ForbiddenError, UnauthorizedError } from "../http/errors.js";

export type PolicyHandler = RequestHandler & {
  authenticatedGuard?: true;
  requiredPermission?: Permission;
};

/** Require a Passport session backed by a live database account. */
export const requireAuthenticated: PolicyHandler = (req, _res, next) => {
  if (!req.isAuthenticated?.() || !req.user) {
    next(new UnauthorizedError("unauthenticated"));
    return;
  }
  next();
};
requireAuthenticated.authenticatedGuard = true;

/** Deny by default: the session role must grant the permission. */
export function requirePermission(permission: Permission): PolicyHandler {
  const middleware: PolicyHandler = (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError("unauthenticated"));
      return;
    }
    if (!roleHasPermission(req.user.role, permission)) {
      next(new ForbiddenError("forbidden"));
      return;
    }
    next();
  };
  middleware.requiredPermission = permission;
  return middleware;
}
