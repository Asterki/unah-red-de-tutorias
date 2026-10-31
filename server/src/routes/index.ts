import type { Express } from "express";

import type { AppConfig } from "../config/index.js";
import type { ProviderState } from "../auth/providers.js";
import type { AccountService } from "../services/account-service.js";
import type { DocsService } from "../services/docs-service.js";
import { createAccountsRouter } from "./accounts.js";
import { createAuthRouter } from "./auth.js";
import { createDocsRouter } from "./docs.js";
import { createRolesRouter } from "./roles.js";

export type RouteDependencies = {
  accounts: AccountService;
  docs: DocsService;
  config: AppConfig;
  providers: ProviderState;
};

export function registerRoutes(
  app: Express,
  { accounts, docs, config, providers }: RouteDependencies,
): void {
  app.use("/api/auth", createAuthRouter(accounts, config, providers));
  app.use("/api/accounts", createAccountsRouter(accounts));
  app.use("/api/docs", createDocsRouter(docs));
  app.use("/api/roles", createRolesRouter());
}
