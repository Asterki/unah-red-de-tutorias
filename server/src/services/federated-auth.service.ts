import {
  decideFederatedEmail,
  UNIVERSITY_DOMAINS,
  type FederatedProvider,
  type Role,
} from "@unah-red-tutores/shared";
import { createId } from "@paralleldrive/cuid2";
import type { AuthProvider, PrismaClient } from "@prisma/client";

import { appendHistory, createMetadata } from "../db/audit.js";
import { runInTransaction } from "../db/tx.js";
import { AppError } from "../http/errors.js";
import { primaryRole } from "../rbac/primary-role.js";
import { ID_TYPE_FOR_ROLE } from "./account-service.js";

export type FederatedProfile = {
  provider: FederatedProvider;
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  /** Microsoft tenant (`tid` claim) or Google hosted domain (`hd`). */
  tenantId?: string | null;
};

export type FederatedAuthErrorCode =
  | "domain-not-allowed"
  | "tenant-not-allowed"
  | "use-microsoft-login"
  | "account-locked"
  | "account-banned"
  | "account-inactive"
  | "email-not-verified"
  | "provider-error";

export class FederatedAuthError extends AppError {
  constructor(code: FederatedAuthErrorCode, message: string = code) {
    super(code, 403, message);
    this.name = "FederatedAuthError";
  }
}

export type FederatedAuthServiceOptions = {
  microsoftAllowedTenantIds: readonly string[];
};

type AccountWithRoles = Express.User;

const PROVIDER_LABELS: Record<AuthProvider, FederatedProvider> = {
  microsoft: "microsoft",
  google: "google",
  apple: "apple",
};

function statusError(
  status: "active" | "locked" | "banned" | "inactive",
): FederatedAuthError | null {
  switch (status) {
    case "active":
      return null;
    case "locked":
      return new FederatedAuthError("account-locked");
    case "banned":
      return new FederatedAuthError("account-banned");
    case "inactive":
      return new FederatedAuthError("account-inactive");
  }
}

function normalizeEmail(email: string | null): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function fallbackName(email: string): string {
  return email.split("@")[0] ?? email;
}

/**
 * Resolve a provider profile to a live local account.
 *
 * Rules:
 * - Microsoft requires an allowlisted tenant and an institutional domain.
 * - Google and Apple reject institutional domains (those use Microsoft).
 * - Existing accounts are linked only after the provider rules pass, and their
 *   roles are never changed here.
 * - Soft-deleted accounts never match because their email is hashed.
 */
export function createFederatedAuthService(
  prisma: PrismaClient,
  { microsoftAllowedTenantIds }: FederatedAuthServiceOptions,
) {
  const allowedTenants = new Set(
    microsoftAllowedTenantIds.map((tenant) => tenant.trim().toLowerCase()),
  );

  async function findIdentity(profile: FederatedProfile) {
    return prisma.accountIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
        },
      },
      include: {
        account: { include: { roles: true } },
      },
    });
  }

  function assertAccountUsable(account: AccountWithRoles): void {
    if (account.deletedAt !== null) {
      throw new FederatedAuthError("account-inactive");
    }
    const error = statusError(account.status);
    if (error) {
      throw error;
    }
  }

  function validateMicrosoft(profile: FederatedProfile): void {
    const tenant = profile.tenantId?.trim().toLowerCase();
    if (!tenant || !allowedTenants.has(tenant)) {
      throw new FederatedAuthError("tenant-not-allowed");
    }
  }

  function classify(
    profile: FederatedProfile,
    email: string,
  ): Extract<Role, "student" | "observer" | "external"> {
    if (profile.provider === "microsoft") {
      validateMicrosoft(profile);
    }

    // Google exposes the hosted domain separately from the address; reject it
    // even when the address itself looks external.
    if (profile.provider === "google" && profile.tenantId) {
      const hosted = profile.tenantId.trim().toLowerCase();
      if ((UNIVERSITY_DOMAINS as readonly string[]).includes(hosted)) {
        throw new FederatedAuthError("use-microsoft-login");
      }
    }

    if (
      (profile.provider === "google" || profile.provider === "apple") &&
      !profile.emailVerified
    ) {
      throw new FederatedAuthError("email-not-verified");
    }

    const decision = decideFederatedEmail(
      PROVIDER_LABELS[profile.provider],
      email,
    );
    if (!decision.allowed) {
      throw new FederatedAuthError(decision.error);
    }
    return decision.role;
  }

  async function touchIdentity(
    identityId: string,
    accountId: string,
    email: string | null,
  ): Promise<AccountWithRoles> {
    const now = new Date();
    await prisma.$transaction([
      prisma.accountIdentity.update({
        where: { id: identityId },
        data: {
          lastUsedAt: now,
          ...(email ? { email } : {}),
        },
      }),
      prisma.account.update({
        where: { id: accountId },
        data: { lastLogin: now },
      }),
    ]);

    const account = await prisma.account.findUniqueOrThrow({
      where: { id: accountId },
      include: { roles: true },
    });
    return { ...account, role: primaryRole(account.roles) };
  }

  async function linkIdentity(
    account: AccountWithRoles,
    profile: FederatedProfile,
    email: string,
  ): Promise<AccountWithRoles> {
    assertAccountUsable(account);
    const now = new Date();

    await prisma.$transaction([
      prisma.accountIdentity.create({
        data: {
          accountId: account.id,
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          email,
          lastUsedAt: now,
        },
      }),
      prisma.account.update({
        where: { id: account.id },
        data: { lastLogin: now },
      }),
    ]);

    const linked = await prisma.account.findUniqueOrThrow({
      where: { id: account.id },
      include: { roles: true },
    });
    return { ...linked, role: primaryRole(linked.roles) };
  }

  async function createAccount(
    profile: FederatedProfile,
    email: string,
    role: Extract<Role, "student" | "observer" | "external">,
  ): Promise<AccountWithRoles> {
    const name = profile.name?.trim() || fallbackName(email);
    const now = new Date();

    return runInTransaction(prisma, async (tx) => {
      const metadata = await createMetadata(tx, null);
      const account = await tx.account.create({
        data: {
          email,
          name,
          idType: ID_TYPE_FOR_ROLE[role],
          // Providers never return the institutional identifier. The user (or
          // an administrator) must complete it later; the prefix makes the
          // placeholder visible. No profile-completion flow exists yet.
          identifier: `pending:${createId()}`,
          password: null,
          status: "active",
          mustChangePassword: false,
          lastLogin: now,
          metadataId: metadata.id,
          roles: { create: { role } },
          identities: {
            create: {
              provider: profile.provider,
              providerUserId: profile.providerUserId,
              email,
              lastUsedAt: now,
            },
          },
        },
        include: { roles: true },
      });

      await appendHistory(tx, metadata.id, "account", account.id, null, {
        provider: profile.provider,
        role,
        status: "active",
        source: "federated",
        system: true,
      });

      return { ...account, role: primaryRole(account.roles) };
    });
  }

  return {
    async resolve(profile: FederatedProfile): Promise<AccountWithRoles> {
      const email = normalizeEmail(profile.email);
      let existingIdentity = await findIdentity(profile);

      // A soft-deleted account must not be revived. Drop its stale provider
      // link so a fresh account can claim the same provider subject.
      if (existingIdentity && existingIdentity.account.deletedAt !== null) {
        await prisma.accountIdentity.delete({
          where: { id: existingIdentity.id },
        });
        existingIdentity = null;
      }

      if (existingIdentity) {
        assertAccountUsable({
          ...existingIdentity.account,
          role: primaryRole(existingIdentity.account.roles),
        });
        return touchIdentity(
          existingIdentity.id,
          existingIdentity.accountId,
          email,
        );
      }

      if (!email) {
        throw new FederatedAuthError("provider-error", "email-missing");
      }

      const role = classify(profile, email);

      const existingAccount = await prisma.account.findFirst({
        where: { email, deletedAt: null },
        include: { roles: true },
      });

      if (existingAccount) {
        return linkIdentity(
          { ...existingAccount, role: primaryRole(existingAccount.roles) },
          profile,
          email,
        );
      }

      return createAccount(profile, email, role);
    },
  };
}

export type FederatedAuthService = ReturnType<typeof createFederatedAuthService>;
