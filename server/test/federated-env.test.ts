import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config/index.js";
import { resolveProviders } from "../src/auth/providers.js";

function load(overrides: Record<string, string> = {}) {
  return loadConfig({
    NODE_ENV: "test",
    PORT: "3000",
    DATABASE_URL: "mysql://user:password@localhost:3306/app",
    SESSION_SECRET: "a".repeat(32),
    CORS_ORIGINS: "http://localhost:2173",
    LOG_LEVEL: "silent",
    LOG_FORMAT: "json",
    ...overrides,
  });
}

describe("federated env parsing", () => {
  it("splits, trims and drops empty tenant ids", () => {
    const config = load({
      MICROSOFT_ALLOWED_TENANT_IDS: " tenant-a , ,tenant-b,  ",
    });
    expect(config.microsoftAllowedTenantIds).toEqual([
      "tenant-a",
      "tenant-b",
    ]);
  });

  it("treats a missing tenant list as empty", () => {
    expect(load().microsoftAllowedTenantIds).toEqual([]);
  });

  it("converts escaped newlines in the Apple private key", () => {
    const config = load({
      APPLE_PRIVATE_KEY: "-----BEGIN\\nkey\\n-----END",
    });
    expect(config.applePrivateKey).toBe("-----BEGIN\nkey\n-----END");
  });

  it("defaults the callback base to localhost and strips trailing slashes", () => {
    expect(load().authCallbackBaseUrl).toBeUndefined();
    expect(
      load({ AUTH_CALLBACK_BASE_URL: "https://api.example.test/" })
        .authCallbackBaseUrl,
    ).toBe("https://api.example.test");
  });
});

describe("provider enablement", () => {
  it("enables nothing when no provider is configured", () => {
    const config = load();
    expect(resolveProviders(config).enabled).toEqual([]);
    expect(resolveProviders(config).isEnabled("microsoft")).toBe(false);
  });

  it("requires Microsoft client id, secret and at least one tenant", () => {
    const withoutTenants = load({
      MICROSOFT_CLIENT_ID: "client",
      MICROSOFT_CLIENT_SECRET: "secret",
    });
    expect(resolveProviders(withoutTenants).enabled).toEqual([]);

    const complete = load({
      MICROSOFT_CLIENT_ID: "client",
      MICROSOFT_CLIENT_SECRET: "secret",
      MICROSOFT_ALLOWED_TENANT_IDS: "tenant-a",
    });
    expect(resolveProviders(complete).enabled).toEqual(["microsoft"]);
  });

  it("enables Google with a client id and secret", () => {
    const config = load({
      GOOGLE_CLIENT_ID: "client",
      GOOGLE_CLIENT_SECRET: "secret",
    });
    expect(resolveProviders(config).enabled).toEqual(["google"]);
  });

  it("requires the full Apple key material", () => {
    const incomplete = load({
      APPLE_CLIENT_ID: "services-id",
      APPLE_TEAM_ID: "team",
      APPLE_KEY_ID: "key",
    });
    expect(resolveProviders(incomplete).enabled).toEqual([]);

    const complete = load({
      APPLE_CLIENT_ID: "services-id",
      APPLE_TEAM_ID: "team",
      APPLE_KEY_ID: "key",
      APPLE_PRIVATE_KEY: "private",
    });
    expect(resolveProviders(complete).enabled).toEqual(["apple"]);
  });

  it("builds callback URLs from the public base URL", () => {
    const config = load({
      AUTH_CALLBACK_BASE_URL: "https://api.example.test",
      GOOGLE_CLIENT_ID: "client",
      GOOGLE_CLIENT_SECRET: "secret",
    });
    expect(resolveProviders(config).callbackUrl("google")).toBe(
      "https://api.example.test/api/auth/google/callback",
    );
  });
});
