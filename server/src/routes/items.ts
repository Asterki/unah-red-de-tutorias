import { Router } from "express";
import {
  createItemSchema,
  idParamSchema,
  listItemsQuerySchema,
  updateItemSchema,
} from "@unah-red-tutores/shared";

import { createItemsController } from "../controllers/items.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../http/validation.js";
import {
  requireAuthenticated,
  requirePermission,
} from "../middleware/require-permission.js";
import type { ItemService } from "../services/item-service.js";

export function createItemsRouter(items: ItemService): Router {
  const router = Router();
  const controller = createItemsController({ items });

  router.get(
    "/",
    requireAuthenticated,
    requirePermission("items:read"),
    validateQuery(listItemsQuerySchema),
    controller.list,
  );

  router.get(
    "/:id",
    requireAuthenticated,
    requirePermission("items:read"),
    validateParams(idParamSchema),
    controller.get,
  );

  router.post(
    "/",
    requireAuthenticated,
    requirePermission("items:create"),
    validateBody(createItemSchema),
    controller.create,
  );

  router.patch(
    "/:id",
    requireAuthenticated,
    requirePermission("items:update"),
    validateParams(idParamSchema),
    validateBody(updateItemSchema),
    controller.update,
  );

  router.delete(
    "/:id",
    requireAuthenticated,
    requirePermission("items:delete"),
    validateParams(idParamSchema),
    controller.remove,
  );

  router.post(
    "/:id/restore",
    requireAuthenticated,
    requirePermission("items:restore"),
    validateParams(idParamSchema),
    controller.restore,
  );

  return router;
}
