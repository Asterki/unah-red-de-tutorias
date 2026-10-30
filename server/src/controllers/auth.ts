import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import passport from "passport";
import type { ChangePasswordRequest } from "@unah-red-tutores/shared";

import type { AppConfig } from "../config/index.js";
import {
  clearSessionCookieOptions,
  csrfCookieName,
  csrfCookieOptions,
  sessionCookieName,
} from "../http/cookies.js";
import { toSessionAccountDto } from "../http/dto/accounts.js";
import { UnauthorizedError } from "../http/errors.js";
import type { AccountService } from "../services/account-service.js";

export function createAuthController(
  accounts: AccountService,
  config: Pick<AppConfig, "nodeEnv" | "cookieDomain">,
) {
  const login: RequestHandler = (req, res, next) => {
    passport.authenticate(
      "local",
      { session: false },
      (
        error: unknown,
        user: Express.User | false,
        info?: { message?: string },
      ) => {
        if (error) {
          next(error);
          return;
        }
        if (!user) {
          next(new UnauthorizedError(info?.message ?? "invalid-credentials"));
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

            accounts
              .recordLogin(user.id)
              .then(({ lastLogin }) => {
                res.json({
                  data: toSessionAccountDto({ ...user, lastLogin }),
                });
              })
              .catch(next);
          });
        });
      },
    )(req, res, next);
  };

  const csrf: RequestHandler = (_req, res) => {
    const csrfToken = randomBytes(32).toString("hex");

    res.cookie(csrfCookieName(config), csrfToken, csrfCookieOptions(config));
    res.setHeader("Cache-Control", "no-store");
    res.json({ csrfToken });
  };

  const logout: RequestHandler = (req, res, next) => {
    req.logout((logoutError) => {
      if (logoutError) {
        next(logoutError);
        return;
      }

      req.session.destroy((destroyError) => {
        if (destroyError) {
          next(destroyError);
          return;
        }

        res.clearCookie(
          sessionCookieName(config),
          clearSessionCookieOptions(config),
        );
        res.json({ data: { success: true } });
      });
    });
  };

  const me: RequestHandler = (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError("unauthenticated");
    }
    res.json({ data: toSessionAccountDto(req.user) });
  };

  const changePassword: RequestHandler = async (req, res, next) => {
    if (!req.user) {
      throw new UnauthorizedError("unauthenticated");
    }
    const current = req.user;
    const body = req.body as ChangePasswordRequest;

    const updated = await accounts.changeOwnPassword(
      current.id,
      body.currentPassword,
      body.newPassword,
    );

    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        next(regenerateError);
        return;
      }

      req.logIn(current, (loginError) => {
        if (loginError) {
          next(loginError);
          return;
        }
        res.json({ data: toSessionAccountDto(updated) });
      });
    });
  };

  return { login, csrf, logout, me, changePassword };
}
