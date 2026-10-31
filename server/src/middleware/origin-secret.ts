import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import type { Logger } from "pino";

import type { AppConfig } from "../config/index.js";
import { ForbiddenError } from "../http/errors.js";

/**
 * Exact `METHOD /path` pairs that may skip the origin-secret check, and only
 * when `NODE_ENV === "development"`. No prefixes, regexes or query strings.
 */
export const OAUTH_ORIGIN_SECRET_BYPASS_ROUTES: ReadonlySet<string> = new Set([
  "GET /api/auth/microsoft",
  "GET /api/auth/microsoft/callback",
  "GET /api/auth/google",
  "GET /api/auth/google/callback",
  "GET /api/auth/apple",
  "POST /api/auth/apple/callback",
]);

/**
 * Development-only escape hatch for browser OAuth redirects, which hit the API
 * directly instead of going through the Vite proxy.
 *
 * Production and every non-development environment always return false, so no
 * setting or header can enable the bypass there.
 */
export function isOAuthOriginSecretBypass(
  nodeEnv: AppConfig["nodeEnv"],
  method: string,
  path: string,
): boolean {
  if (nodeEnv !== "development") {
    return false;
  }
  return OAUTH_ORIGIN_SECRET_BYPASS_ROUTES.has(
    `${method.toUpperCase()} ${path}`,
  );
}

function matches(expected: string, actual: string | undefined): boolean {
  if (actual === undefined) {
    return false;
  }
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

/**
 * Optional shared secret for the proxy in front of the API.
 *
 * When unset the check is skipped, which keeps local development and tests
 * working. Health endpoints are mounted outside `/api` and stay exempt.
 */
export function originSecret(
  config: Pick<AppConfig, "originSecret" | "nodeEnv">,
  logger: Pick<Logger, "warn">,
): RequestHandler {
  const expected = config.originSecret;
  if (!expected) {
    return (_req, _res, next) => next();
  }

  if (config.nodeEnv === "development") {
    logger.warn(
      "origin-secret bypass active for OAuth routes (development only)",
    );
  }

  return (req, _res, next) => {
    // `req.path` is relative to the `/api` mount, so reconstruct the full path.
    const path = `${req.baseUrl}${req.path}`;
    if (isOAuthOriginSecretBypass(config.nodeEnv, req.method, path)) {
      next();
      return;
    }

    if (!matches(expected, req.get("x-origin-secret"))) {
      next(new ForbiddenError("invalid-origin-secret"));
      return;
    }
    next();
  };
}
