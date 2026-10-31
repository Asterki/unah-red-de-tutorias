import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

import bcrypt from "bcrypt";
import type { PrismaClient } from "@prisma/client";

import { loadSeedConfig, type SeedAppConfig } from "../config/index.js";
import { createPrismaClient } from "../db/prisma.js";
import { appendHistory, createMetadata } from "../db/audit.js";
import { runInTransaction } from "../db/tx.js";

const BCRYPT_COST = 12;

export type SeedConfig = Pick<
  SeedAppConfig,
  "bootstrapAdminEmail" | "bootstrapAdminName" | "bootstrapAdminPassword"
>;

export type SeedResult = {
  created: boolean;
  generatedPassword?: string;
};

export type SeedDependencies = {
  prisma: PrismaClient;
  config: SeedConfig;
  write?: (chunk: string) => void;
};

function generatePassword(): string {
  return randomBytes(18).toString("base64url");
}

/**
 * Create the first administrator exactly once.
 *
 * The generated password is written to stdout once and is never passed to the
 * logger, stored in the audit trail, or returned from an HTTP route.
 */
export async function seedAdmin({
  prisma,
  config,
  write = (chunk) => process.stdout.write(chunk),
}: SeedDependencies): Promise<SeedResult> {
  const existing = await prisma.account.count();
  if (existing > 0) {
    return { created: false };
  }

  const email = config.bootstrapAdminEmail?.trim().toLowerCase();
  if (!email) {
    throw new Error(
      "BOOTSTRAP_ADMIN_EMAIL is required to create the first administrator",
    );
  }

  const name = config.bootstrapAdminName?.trim() || "Administrator";
  const providedPassword = config.bootstrapAdminPassword?.trim();
  const generated = !providedPassword;
  const password = providedPassword || generatePassword();
  const hash = await bcrypt.hash(password, BCRYPT_COST);

  await runInTransaction(prisma, async (tx) => {
    const metadata = await createMetadata(tx, null);

    const account = await tx.account.create({
      data: {
        email,
        name,
        idType: "account_number",
        identifier: "bootstrap-admin",
        password: hash,
        status: "active",
        mustChangePassword: true,
        metadataId: metadata.id,
        roles: { create: { role: "tech_admin" } },
      },
    });

    await appendHistory(tx, metadata.id, "account", account.id, null, {
      email,
      name,
      role: "tech_admin",
      status: "active",
      bootstrap: true,
    });
  });

  if (generated) {
    write(
      [
        "",
        "============================================================",
        " Initial administrator password (shown only once)",
        ` Email:    ${email}`,
        ` Password: ${password}`,
        " Change it after the first login.",
        "============================================================",
        "",
      ].join("\n"),
    );
  }

  return generated
    ? { created: true, generatedPassword: password }
    : { created: true };
}

async function main(): Promise<void> {
  const config = loadSeedConfig();
  const prisma = createPrismaClient(config);

  try {
    await prisma.$connect();
    const result = await seedAdmin({ prisma, config });
    if (!result.created) {
      process.stdout.write("Seed skipped: accounts already exist.\n");
    }
  } finally {
    await prisma.$disconnect();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `Seed failed: ${error instanceof Error ? error.message : "unknown error"}\n`,
    );
    process.exitCode = 1;
  });
}
