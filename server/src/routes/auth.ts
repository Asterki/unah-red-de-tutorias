import { Router } from "express";
import {
  changePasswordSchema,
  loginAccountSchema,
} from "@unah-red-tutores/shared";

import type { AppConfig } from "../config/index.js";
import { createAuthController } from "../controllers/auth.js";
import { createFederatedAuthController } from "../controllers/federated-auth.js";
import { validateBody } from "../http/validation.js";
import { loginRateLimit } from "../middleware/rate-limit.js";
import { requireAuthenticated } from "../middleware/require-permission.js";
import type { ProviderState } from "../auth/providers.js";
import type { AccountService } from "../services/account-service.js";

export function createAuthRouter(
  accounts: AccountService,
  config: AppConfig,
  providers: ProviderState,
): Router {
  const router = Router();
  const controller = createAuthController(accounts, config);
  const federated = createFederatedAuthController(config, providers);

  router.get("/providers", federated.listProviders);

  router.get(
    "/microsoft",
    loginRateLimit(config),
    federated.begin("microsoft"),
  );
  router.get(
    "/microsoft/callback",
    loginRateLimit(config),
    federated.callback("microsoft"),
  );
  router.get("/google", loginRateLimit(config), federated.begin("google"));
  router.get(
    "/google/callback",
    loginRateLimit(config),
    federated.callback("google"),
  );
  router.get("/apple", loginRateLimit(config), federated.begin("apple"));
  router.post(
    "/apple/callback",
    loginRateLimit(config),
    federated.callback("apple"),
  );

  router.post(
    "/login",
    loginRateLimit(config),
    validateBody(loginAccountSchema),
    controller.login,
  );
  router.get("/csrf", controller.csrf);
  router.post("/logout", requireAuthenticated, controller.logout);
  router.get("/me", requireAuthenticated, controller.me);
  router.post(
    "/change-password",
    requireAuthenticated,
    validateBody(changePasswordSchema),
    controller.changePassword,
  );

  return router;
}
