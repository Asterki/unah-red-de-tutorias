import type { PrismaClient } from "@prisma/client";
import passport from "passport";
import type { Logger } from "pino";

import { withPrimaryRole } from "./session-user.js";
import { createLocalStrategy } from "./strategies/local.js";

export type PassportDependencies = {
  prisma: PrismaClient;
  logger: Logger;
};

/**
 * Configure Passport's session serialization and the local strategy.
 *
 * Provider strategies are registered separately by
 * `configureFederatedStrategies` so session setup stays independent of which
 * OAuth providers are enabled.
 */
export function configurePassport({ prisma, logger }: PassportDependencies) {
  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.account.findUnique({
        where: { id },
        include: { roles: true },
      });
      if (user === null || user.deletedAt !== null || user.status !== "active") {
        done(null, false);
        return;
      }
      done(null, withPrimaryRole(user) as Express.User);
    } catch (error) {
      done(error);
    }
  });

  passport.use(createLocalStrategy({ prisma, logger }));
}
