import express, { type Express } from "express";
import cookie from "cookie-parser";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import type { Logger } from "pino";

import type { AppConfig } from "./config/index.js";
import { errorHandler } from "./http/error-handler.js";
import { notFound } from "./http/not-found.js";
import { csrfProtection } from "./middleware/csrf.js";
import { originSecret } from "./middleware/origin-secret.js";
import { enforcePasswordChange } from "./middleware/password-change.js";
import { globalRateLimit } from "./middleware/rate-limit.js";
import { requestLogger } from "./middleware/request-logger.js";
import { corsMiddleWare, securityHeaders } from "./middleware/security.js";
import { createHealthRouter } from "./routes/health.js";
import { registerRoutes } from "./routes/index.js";
import { resolveProviders } from "./auth/providers.js";
import { configurePassport } from "./auth/passport.js";
import { configureFederatedStrategies } from "./auth/strategies.js";
import { createAccountService } from "./services/account-service.js";
import { createDocsService } from "./services/docs-service.js";
import { createFederatedAuthService } from "./services/federated-auth.service.js";
import { createSessionManager } from "./services/sessions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version?: string };

const APP_VERSION = packageJson.version ?? "0.0.0";

export type AppDependencies = {
  config: AppConfig;
  logger: Logger;
  prisma: PrismaClient;
};

/**
 * Build the Express application.
 *
 * All I/O (config, logging, database) is supplied by the caller so tests can
 * construct an app with fakes and importing this module has no side effects.
 */
export function createApp({
  config,
  logger,
  prisma,
}: AppDependencies): Express {
  const app = express();

  app.set("trust proxy", config.trustProxy);

  app.use(requestLogger(logger));
  app.use(securityHeaders());
  app.use(corsMiddleWare(config));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookie(config.sessionSecret));
  app.use(createHealthRouter({ prisma, logger }));
  app.use("/uploads/", express.static(path.join(__dirname, "../uploads")));

  const sessions = createSessionManager({ config, prisma });
  configurePassport({ prisma, logger });
  sessions.loadToServer(app);

  app.use(enforcePasswordChange);
  app.use("/api", originSecret(config, logger));
  app.use("/api", globalRateLimit(config));
  // Apple posts its callback as a cross-site form, so only that route accepts
  // urlencoded bodies. It is also the only unsafe route exempt from CSRF.
  app.use(
    "/api/auth/apple/callback",
    express.urlencoded({ extended: false, limit: "16kb" }),
  );
  app.use(csrfProtection(config));

  const providers = resolveProviders(config);
  const federated = createFederatedAuthService(prisma, {
    microsoftAllowedTenantIds: config.microsoftAllowedTenantIds,
  });
  configureFederatedStrategies({ config, providers, federated });

  registerRoutes(app, {
    accounts: createAccountService(prisma, {
      softDeleteHashKey: config.softDeleteHashKey,
    }),
    docs: createDocsService({ docsDir: config.docsDir }),
    config,
    providers,
  });
  app.use("/api", notFound);

  if (config.serveClient) {
    const clientPath = path.resolve(config.clientDir);
    app.use(express.static(clientPath));
    app.get(/.*/, (req, res, next) => {
      if (
        req.path === "/api" ||
        req.path.startsWith("/api/") ||
        req.path === "/healthz" ||
        req.path === "/readyz"
      ) {
        next();
        return;
      }
      res.sendFile(path.join(clientPath, "index.html"));
    });
  } else {
    app.get("/", (_req, res) => {
      res.json({ service: config.serviceName, version: APP_VERSION });
    });
  }

  app.use(errorHandler);

  return app;
}
