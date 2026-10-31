import type { Express } from "express";
import session from "express-session";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";
import type { PrismaClient } from "@prisma/client";
import passport from "passport";

import type { AppConfig } from "../config/index.js";
import { sessionCookieName, sessionCookieOptions } from "../http/cookies.js";

export type SessionDependencies = {
  config: AppConfig;
  prisma: PrismaClient;
};

/**
 * Build the shared HTTP session.
 *
 * Passport serialization and strategies live in `server/src/auth/passport.ts`;
 * this module only owns the session store, cookie and middleware wiring.
 */
export function createSessionManager({
  config,
  prisma,
}: SessionDependencies) {
  const sessionMiddleware = session({
    name: sessionCookieName(config),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: sessionCookieOptions(config),
    store: new PrismaSessionStore(prisma as never, {
      checkPeriod: 2 * 60 * 1000, // Prune expired sessions every 2 minutes
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  });

  return {
    getSessionMiddleware() {
      return sessionMiddleware;
    },
    loadToServer(server: Express) {
      server.use(sessionMiddleware);
      server.use(passport.initialize());
      server.use(passport.session());
    },
  };
}

export default createSessionManager;
