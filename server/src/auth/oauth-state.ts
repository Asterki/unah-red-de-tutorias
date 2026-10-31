import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { Request, Response } from "express";
import type { CookieOptions } from "express";

import type { FederatedProvider } from "@unah-red-tutores/shared";

import type { AppConfig } from "../config/index.js";

export const OAUTH_STATE_MAX_AGE_MS = 1000 * 60 * 10;

type StateConfig = Pick<AppConfig, "nodeEnv" | "sessionSecret">;

export function oauthStateCookieName(
  config: Pick<AppConfig, "nodeEnv">,
): string {
  return config.nodeEnv === "production"
    ? "__Secure-app.oauth_state"
    : "app.oauth_state";
}

/**
 * The OAuth state cookie must survive Apple's cross-site `form_post` callback,
 * which does not send a `SameSite=Lax` session cookie. `SameSite=None` requires
 * `Secure`, so this cookie only works over HTTPS (Apple requires HTTPS anyway).
 */
export function oauthStateCookieOptions(
  _config: StateConfig,
): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/api/auth",
    maxAge: OAUTH_STATE_MAX_AGE_MS,
  };
}

function sign(config: StateConfig, payload: string): string {
  return createHmac("sha256", config.sessionSecret)
    .update(payload)
    .digest("base64url");
}

export function createOAuthState(
  config: StateConfig,
  provider: FederatedProvider,
): { state: string; cookie: string } {
  const state = `${randomBytes(24).toString("base64url")}.${provider}.${Date.now()}`;
  const cookie = `${state}.${sign(config, state)}`;
  return { state, cookie };
}

function safeEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Verify the signed state cookie, the query/body value and the age. */
export function verifyOAuthState(
  req: Request,
  config: StateConfig,
  provider: FederatedProvider,
): boolean {
  const cookieName = oauthStateCookieName(config);
  const cookieValue = req.cookies?.[cookieName];
  const bodyState = (req.body as Record<string, unknown> | undefined)?.state;
  const queryState = req.query.state;
  const state =
    typeof bodyState === "string"
      ? bodyState
      : typeof queryState === "string"
        ? queryState
        : null;

  if (!cookieValue || !state) {
    return false;
  }
  const parts = state.split(".");
  if (parts.length !== 3 || parts[1] !== provider) {
    return false;
  }
  if (!safeEquals(cookieValue, `${state}.${sign(config, state)}`)) {
    return false;
  }

  const issuedAt = Number(parts[2]);
  return (
    Number.isFinite(issuedAt) &&
    Date.now() - issuedAt >= 0 &&
    Date.now() - issuedAt <= OAUTH_STATE_MAX_AGE_MS
  );
}

export function clearOAuthState(
  res: Response,
  config: StateConfig,
): void {
  res.clearCookie(oauthStateCookieName(config), {
    ...oauthStateCookieOptions(config),
    maxAge: undefined,
  });
}
