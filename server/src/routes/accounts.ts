import { Router } from "express";
import {
  createAccountSchema,
  idParamSchema,
  listAccountsQuerySchema,
  setAccountPasswordSchema,
  setAccountStatusSchema,
  updateAccountSchema,
} from "@unah-red-tutores/shared";

import { createAccountsController } from "../controllers/accounts.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../http/validation.js";
import {
  requireAuthenticated,
  requirePermission,
} from "../middleware/require-permission.js";
import type { AccountService } from "../services/account-service.js";

export function createAccountsRouter(accounts: AccountService): Router {
  const router = Router();
  const controller = createAccountsController({ accounts });

  router.get(
    "/",
    requireAuthenticated,
    requirePermission("accounts:read"),
    validateQuery(listAccountsQuerySchema),
    controller.list,
  );

  router.get(
    "/:id",
    requireAuthenticated,
    requirePermission("accounts:read"),
    validateParams(idParamSchema),
    controller.get,
  );

  router.post(
    "/",
    requireAuthenticated,
    requirePermission("accounts:create"),
    validateBody(createAccountSchema),
    controller.create,
  );

  router.patch(
    "/:id",
    requireAuthenticated,
    requirePermission("accounts:update"),
    validateParams(idParamSchema),
    validateBody(updateAccountSchema),
    controller.update,
  );

  router.post(
    "/:id/status",
    requireAuthenticated,
    requirePermission("accounts:update-status"),
    validateParams(idParamSchema),
    validateBody(setAccountStatusSchema),
    controller.setStatus,
  );

  router.post(
    "/:id/password",
    requireAuthenticated,
    requirePermission("accounts:change-password"),
    validateParams(idParamSchema),
    validateBody(setAccountPasswordSchema),
    controller.setPassword,
  );

  router.delete(
    "/:id",
    requireAuthenticated,
    requirePermission("accounts:delete"),
    validateParams(idParamSchema),
    controller.remove,
  );

  router.post(
    "/:id/restore",
    requireAuthenticated,
    requirePermission("accounts:restore"),
    validateParams(idParamSchema),
    controller.restore,
  );

  return router;
}
