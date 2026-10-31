import type { RequestHandler } from "express";
import passport from "passport";
import type { FederatedProvider } from "@unah-red-tutores/shared";

import type { AppConfig } from "../config/index.js";
import { AppError, NotFoundError } from "../http/errors.js";
import {
  clearOAuthState,
  createOAuthState,
  oauthStateCookieName,
  oauthStateCookieOptions,
  verifyOAuthState,
} from "../auth/oauth-state.js";
import type { ProviderState } from "../auth/providers.js";

const KNOWN_ERROR_CODES = new Set([
  "domain-not-allowed",
  "tenant-not-allowed",
  "use-microsoft-login",
  "account-locked",
  "account-banned",
  "account-inactive",
  "email-not-verified",
  "provider-error",
]);

type CallbackConfig = Pick<
  AppConfig,
  | "nodeEnv"
  | "sessionSecret"
  | "authSuccessRedirect"
  | "authFailureRedirect"
>;

function errorCode(error: unknown): string {
  if (error instanceof AppError && KNOWN_ERROR_CODES.has(error.code)) {
    return error.code;
  }
  return "provider-error";
}

function failureRedirect(base: string, code: string): string {
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}error=${encodeURIComponent(code)}`;
}

export function createFederatedAuthController(
  config: CallbackConfig,
  providers: ProviderState,
) {
  const listProviders: RequestHandler = (_req, res) => {
    res.json({ data: { providers: providers.enabled } });
  };

  const begin = (provider: FederatedProvider): RequestHandler => {
    return (req, res, next) => {
      if (!providers.isEnabled(provider)) {
        next(new NotFoundError());
        return;
      }

      const { state, cookie } = createOAuthState(config, provider);
      res.cookie(
        oauthStateCookieName(config),
        cookie,
        oauthStateCookieOptions(config),
      );
      passport.authenticate(provider, {
        session: false,
        state,
        ...(provider === "microsoft" ? { prompt: "select_account" } : {}),
      })(req, res, next);
    };
  };

  const callback = (provider: FederatedProvider): RequestHandler => {
    return (req, res, next) => {
      if (!providers.isEnabled(provider)) {
        next(new NotFoundError());
        return;
      }

      if (!verifyOAuthState(req, config, provider)) {
        clearOAuthState(res, config);
        req.log.warn({
          provider,
          outcome: "failure",
          errorCode: "invalid-state",
        });
        res.redirect(
          failureRedirect(config.authFailureRedirect, "invalid-state"),
        );
        return;
      }

      clearOAuthState(res, config);

      passport.authenticate(
        provider,
        { session: false },
        (error: unknown, user: Express.User | false) => {
          if (error) {
            const code = errorCode(error);
            req.log.warn({ provider, outcome: "failure", errorCode: code });
            res.redirect(failureRedirect(config.authFailureRedirect, code));
            return;
          }
          if (!user) {
            req.log.warn({
              provider,
              outcome: "failure",
              errorCode: "provider-error",
            });
            res.redirect(
              failureRedirect(config.authFailureRedirect, "provider-error"),
            );
            return;
          }

          req.session.regenerate((regenerateError) => {
            if (regenerateError) {
              next(regenerateError);
              return;
            }

            req.logIn(user, (loginError) => {
              if (loginError) {
                next(loginError);
                return;
              }
              req.log.info({ provider, outcome: "success" });
              res.redirect(config.authSuccessRedirect);
            });
          });
        },
      )(req, res, next);
    };
  };

  return { listProviders, begin, callback };
}

export type FederatedAuthController = ReturnType<
  typeof createFederatedAuthController
>;
