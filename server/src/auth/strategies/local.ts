import bcrypt from "bcrypt";
import type { PrismaClient } from "@prisma/client";
import passportLocal from "passport-local";
import type { Logger } from "pino";

import { withPrimaryRole } from "../session-user.js";

const BCRYPT_COST = 12;

export type LocalStrategyDependencies = {
  prisma: PrismaClient;
  logger: Logger;
};

/**
 * Email + password strategy.
 *
 * Federated-only accounts have no password hash and never authenticate here.
 */
export function createLocalStrategy({
  prisma,
  logger,
}: LocalStrategyDependencies) {
  return new passportLocal.Strategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const account = await prisma.account.findFirst({
          where: {
            email: email.trim().toLowerCase(),
            deletedAt: null,
          },
          include: { roles: true },
        });

        // Federated-only accounts have no password and can never use this path.
        if (!account || !account.password) {
          return done(null, false, { message: "invalid-credentials" });
        }

        const valid = await bcrypt.compare(password, account.password);
        if (!valid) {
          return done(null, false, { message: "invalid-credentials" });
        }

        if (account.status !== "active") {
          return done(null, false, { message: "account-locked" });
        }

        if (bcrypt.getRounds(account.password) !== BCRYPT_COST) {
          const rehashed = await bcrypt.hash(password, BCRYPT_COST);
          await prisma.account.update({
            where: { id: account.id },
            data: { password: rehashed },
          });
          account.password = rehashed;
        }

        logger.info({ accountId: account.id }, "Account login");
        return done(null, withPrimaryRole(account));
      } catch (error) {
        return done(error);
      }
    },
  );
}
