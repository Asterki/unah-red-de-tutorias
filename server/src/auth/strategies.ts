import passport from "passport";
import { Strategy as AppleStrategy } from "passport-apple";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as MicrosoftStrategy } from "passport-microsoft";
import {
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose";

import type { AppConfig } from "../config/index.js";
import { AppError } from "../http/errors.js";
import {
  FederatedAuthError,
  type FederatedAuthService,
} from "../services/federated-auth.service.js";
import type { FederatedProviderConfig, ProviderState } from "./providers.js";

const MICROSOFT_TENANT = "organizations";
const APPLE_ISSUER = "https://appleid.apple.com";

type StrategyConfig = FederatedProviderConfig &
  Pick<AppConfig, "microsoftClientId" | "microsoftClientSecret" | "googleClientId" | "googleClientSecret" | "appleClientId" | "appleTeamId" | "appleKeyId" | "applePrivateKey" | "applePrivateKeyPath">;

function providerError(): Error {
  return new FederatedAuthError("provider-error");
}

function asHttpError(error: unknown): Error {
  if (error instanceof AppError) {
    return error;
  }
  return providerError();
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return null;
}

const microsoftJwks = new Map<string, JWTVerifyGetKey>();

function microsoftKeySet(tenantId: string): JWTVerifyGetKey {
  const existing = microsoftJwks.get(tenantId);
  if (existing) return existing;
  const jwks = createRemoteJWKSet(
    new URL(
      `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/discovery/v2.0/keys`,
    ),
  );
  microsoftJwks.set(tenantId, jwks);
  return jwks;
}

const appleJwks = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

async function verifyMicrosoftIdToken(
  config: StrategyConfig,
  idToken: string,
): Promise<Record<string, unknown>> {
  const decoded = decodeJwt(idToken);
  const tenantId = typeof decoded.tid === "string" ? decoded.tid : null;
  if (!tenantId) {
    throw new FederatedAuthError("tenant-not-allowed");
  }
  if (!config.microsoftAllowedTenantIds.includes(tenantId.toLowerCase())) {
    throw new FederatedAuthError("tenant-not-allowed");
  }

  const { payload } = await jwtVerify(
    idToken,
    microsoftKeySet(tenantId),
    {
      audience: config.microsoftClientId,
      issuer: [
        `https://login.microsoftonline.com/${tenantId}/v2.0`,
        `https://sts.windows.net/${tenantId}/`,
      ],
    },
  );
  return payload;
}

/**
 * Register every configured provider. Passport keeps one strategy per name, so
 * this runs once per app instance.
 */
export function configureFederatedStrategies({
  config,
  providers,
  federated,
}: {
  config: StrategyConfig;
  providers: ProviderState;
  federated: FederatedAuthService;
}): void {
  if (providers.isEnabled("microsoft")) {
    passport.use(
      "microsoft",
      new MicrosoftStrategy(
        {
          clientID: config.microsoftClientId!,
          clientSecret: config.microsoftClientSecret!,
          callbackURL: providers.callbackUrl("microsoft"),
          tenant: MICROSOFT_TENANT,
          scope: ["openid", "profile", "email", "User.Read"],
          // Some tenants omit `email`; the UPN is the institutional address.
          addUPNAsEmail: true,
        },
        async (_accessToken, _refreshToken, params, profile, done) => {
          try {
            const idToken = params.id_token;
            if (typeof idToken !== "string") {
              throw providerError();
            }
            const payload = await verifyMicrosoftIdToken(config, idToken);
            const email = firstString(
              payload.email,
              payload.preferred_username,
              payload.upn,
              profile.emails?.[0]?.value,
              profile._json?.mail,
              profile._json?.userPrincipalName,
            );
            const user = await federated.resolve({
              provider: "microsoft",
              providerUserId: String(
                payload.oid ?? payload.sub ?? profile.id ?? "",
              ),
              email,
              emailVerified: true,
              name: firstString(payload.name, profile.displayName),
              tenantId: payload.tid as string,
            });
            done(null, user);
          } catch (error) {
            done(asHttpError(error));
          }
        },
      ),
    );
  }

  if (providers.isEnabled("google")) {
    passport.use(
      "google",
      new GoogleStrategy(
        {
          clientID: config.googleClientId!,
          clientSecret: config.googleClientSecret!,
          callbackURL: providers.callbackUrl("google"),
          scope: ["openid", "email", "profile"],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const json = (profile._json ?? {}) as {
              sub?: string;
              email?: string;
              email_verified?: boolean;
              hd?: string;
            };
            const user = await federated.resolve({
              provider: "google",
              providerUserId: String(json.sub ?? profile.id),
              email: firstString(json.email, profile.emails?.[0]?.value),
              emailVerified: json.email_verified === true,
              name: firstString(profile.displayName),
              tenantId: json.hd ?? null,
            });
            done(null, user);
          } catch (error) {
            done(asHttpError(error));
          }
        },
      ),
    );
  }

  if (providers.isEnabled("apple")) {
    passport.use(
      "apple",
      new AppleStrategy(
        {
          clientID: config.appleClientId!,
          teamID: config.appleTeamId!,
          keyID: config.appleKeyId!,
          callbackURL: providers.callbackUrl("apple"),
          ...(config.applePrivateKey
            ? { privateKeyString: config.applePrivateKey }
            : { privateKeyLocation: config.applePrivateKeyPath! }),
          passReqToCallback: true,
          scope: ["name", "email"],
        },
        async (
          req,
          _accessToken,
          _refreshToken,
          idToken,
          profile,
          done,
        ) => {
          try {
            const { payload } = await jwtVerify(idToken, appleJwks, {
              issuer: APPLE_ISSUER,
              audience: config.appleClientId,
            });
            const appleProfile = (
              req as {
                appleProfile?: {
                  name?: { firstName?: string; lastName?: string };
                };
              }
            ).appleProfile;
            const fullName =
              [
                appleProfile?.name?.firstName,
                appleProfile?.name?.lastName,
              ]
                .filter(Boolean)
                .join(" ") ||
              firstString(profile.displayName) ||
              null;

            const user = await federated.resolve({
              provider: "apple",
              providerUserId: String(payload.sub),
              email: firstString(payload.email),
              emailVerified:
                payload.email_verified === true ||
                payload.email_verified === "true",
              name: fullName,
              tenantId: null,
            });
            done(null, user);
          } catch (error) {
            done(asHttpError(error));
          }
        },
      ),
    );
  }
}
