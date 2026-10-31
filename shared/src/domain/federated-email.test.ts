import { describe, expect, it } from "vitest";

import {
  decideFederatedEmail,
  emailDomain,
  isUniversityEmail,
  universityDomainOf,
  type FederatedProvider,
} from "./federated-email.js";

describe("emailDomain", () => {
  it("returns the exact domain after the last @", () => {
    expect(emailDomain("Person@UNAH.HN")).toBe("unah.hn");
    expect(emailDomain("  a@unah.edu.hn  ")).toBe("unah.edu.hn");
    expect(emailDomain("a@x.unah.hn")).toBe("x.unah.hn");
    expect(emailDomain("a@unah.hn.evil.com")).toBe("unah.hn.evil.com");
  });

  it("rejects malformed addresses", () => {
    for (const value of ["", "plain", "@unah.hn", "a@", "a@@unah.hn"]) {
      expect(emailDomain(value)).toBeNull();
    }
  });
});

describe("university domain detection", () => {
  it("matches only the two institutional domains, never subdomains or suffixes", () => {
    const cases = [
      ["someone@unah.hn", true],
      ["someone@unah.edu.hn", true],
      ["someone@UNAH.EDU.HN", true],
      ["evil@x.unah.hn", false],
      ["evil@unah.hn.evil.com", false],
      ["evil@notunah.hn", false],
      ["evil@unah.hn.attacker.test", false],
      ["evil@unah.edu.hn.attacker.test", false],
      ["applicant@gmail.com", false],
      ["a@privaterelay.appleid.com", false],
    ] as const;

    for (const [email, expected] of cases) {
      expect(isUniversityEmail(email), email).toBe(expected);
      expect(universityDomainOf(email) !== null, email).toBe(expected);
    }
  });
});

describe("decideFederatedEmail", () => {
  const cases: Array<{
    provider: FederatedProvider;
    email: string;
    expected: ReturnType<typeof decideFederatedEmail>;
  }> = [
    {
      provider: "microsoft",
      email: "student@unah.hn",
      expected: {
        allowed: true,
        role: "student",
        domain: "unah.hn",
        universityDomain: "unah.hn",
      },
    },
    {
      provider: "microsoft",
      email: " STAFF@UNAH.EDU.HN ",
      expected: {
        allowed: true,
        role: "observer",
        domain: "unah.edu.hn",
        universityDomain: "unah.edu.hn",
      },
    },
    {
      provider: "microsoft",
      email: "someone@gmail.com",
      expected: { allowed: false, error: "domain-not-allowed" },
    },
    {
      provider: "microsoft",
      email: "evil@x.unah.hn",
      expected: { allowed: false, error: "domain-not-allowed" },
    },
    {
      provider: "microsoft",
      email: "evil@unah.hn.evil.com",
      expected: { allowed: false, error: "domain-not-allowed" },
    },
    {
      provider: "google",
      email: "student@unah.hn",
      expected: { allowed: false, error: "use-microsoft-login" },
    },
    {
      provider: "google",
      email: "staff@unah.edu.hn",
      expected: { allowed: false, error: "use-microsoft-login" },
    },
    {
      provider: "apple",
      email: "student@unah.hn",
      expected: { allowed: false, error: "use-microsoft-login" },
    },
    {
      provider: "apple",
      email: "APPLICANT@GMAIL.COM",
      expected: {
        allowed: true,
        role: "external",
        domain: "gmail.com",
        universityDomain: null,
      },
    },
    {
      provider: "apple",
      email: "abc@privaterelay.appleid.com",
      expected: {
        allowed: true,
        role: "external",
        domain: "privaterelay.appleid.com",
        universityDomain: null,
      },
    },
    {
      provider: "google",
      email: "evil@x.unah.hn",
      expected: {
        allowed: true,
        role: "external",
        domain: "x.unah.hn",
        universityDomain: null,
      },
    },
    {
      provider: "google",
      email: "evil@unah.hn.evil.com",
      expected: {
        allowed: true,
        role: "external",
        domain: "unah.hn.evil.com",
        universityDomain: null,
      },
    },
    {
      provider: "microsoft",
      email: "not-an-email",
      expected: { allowed: false, error: "domain-not-allowed" },
    },
    {
      provider: "google",
      email: "not-an-email",
      expected: {
        allowed: true,
        role: "external",
        domain: null,
        universityDomain: null,
      },
    },
  ];

  for (const { provider, email, expected } of cases) {
    it(`${provider}: ${email}`, () => {
      expect(decideFederatedEmail(provider, email)).toEqual(expected);
    });
  }
});
