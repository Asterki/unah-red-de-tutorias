import type { Request } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createOAuthState,
  oauthStateCookieName,
  OAUTH_STATE_MAX_AGE_MS,
  verifyOAuthState,
} from "../src/auth/oauth-state.js";

const config = { nodeEnv: "test" as const, sessionSecret: "s".repeat(32) };

function requestWith(
  cookie: string,
  state: string,
  source: "query" | "body" = "query",
): Request {
  return {
    cookies: { [oauthStateCookieName(config)]: cookie },
    query: source === "query" ? { state } : {},
    body: source === "body" ? { state } : {},
  } as unknown as Request;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("OAuth state", () => {
  it("accepts a freshly signed state from the query", () => {
    const { state, cookie } = createOAuthState(config, "google");
    expect(verifyOAuthState(requestWith(cookie, state), config, "google")).toBe(
      true,
    );
  });

  it("accepts Apple's form_post body", () => {
    const { state, cookie } = createOAuthState(config, "apple");
    expect(
      verifyOAuthState(requestWith(cookie, state, "body"), config, "apple"),
    ).toBe(true);
  });

  it("rejects a different provider", () => {
    const { state, cookie } = createOAuthState(config, "google");
    expect(
      verifyOAuthState(requestWith(cookie, state), config, "microsoft"),
    ).toBe(false);
  });

  it("rejects a tampered state", () => {
    const { state, cookie } = createOAuthState(config, "google");
    const tampered = state.replace(/^./, (char) =>
      char === "a" ? "b" : "a",
    );
    expect(
      verifyOAuthState(requestWith(cookie, tampered), config, "google"),
    ).toBe(false);
  });

  it("rejects a missing cookie", () => {
    const { state } = createOAuthState(config, "google");
    expect(verifyOAuthState(requestWith("", state), config, "google")).toBe(
      false,
    );
  });

  it("rejects an expired state", () => {
    const now = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const { state, cookie } = createOAuthState(config, "google");

    vi.setSystemTime(now + OAUTH_STATE_MAX_AGE_MS + 1);
    expect(verifyOAuthState(requestWith(cookie, state), config, "google")).toBe(
      false,
    );
  });

  it("uses the hardened cookie name in production", () => {
    expect(
      oauthStateCookieName({ nodeEnv: "production" } as typeof config),
    ).toBe("__Secure-app.oauth_state");
    expect(oauthStateCookieName(config)).toBe("app.oauth_state");
  });
});
