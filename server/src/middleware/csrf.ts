import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

import type { AppConfig } from "../config/index.js";
import { ForbiddenError } from "../http/errors.js";
import { csrfCookieName } from "../http/cookies.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Double-submit CSRF protection plus an Origin allowlist for unsafe methods.
 *
 * The token cookie is readable by JavaScript on purpose; the client mirrors it
 * in `x-csrf-token`. Requests without an Origin header (curl, server-to-server)
 * still need a token, which keeps the API safe without a browser.
 */
export function csrfProtection(
  config: Pick<AppConfig, "nodeEnv" | "corsOrigins">,
): RequestHandler {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    // Apple posts the callback as a cross-site form with no CSRF token. Its
    // OAuth `state` cookie provides the equivalent protection.
    if (
      req.method === "POST" &&
      req.path === "/api/auth/apple/callback"
    ) {
      next();
      return;
    }

    const origin = req.get("origin");
    if (origin && !config.corsOrigins.includes(origin)) {
      next(new ForbiddenError("invalid-origin"));
      return;
    }

    const cookieToken = req.cookies?.[csrfCookieName(config)];
    const headerToken = req.get("x-csrf-token");

    if (
      typeof cookieToken !== "string" ||
      typeof headerToken !== "string" ||
      !constantTimeEquals(cookieToken, headerToken)
    ) {
      next(new ForbiddenError("invalid-csrf-token"));
      return;
    }

    next();
  };
}
