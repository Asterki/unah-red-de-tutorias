import type { Role } from "../rbac/roles.js";

export const FEDERATED_PROVIDERS = ["microsoft", "google", "apple"] as const;
export type FederatedProvider = (typeof FEDERATED_PROVIDERS)[number];

export const UNIVERSITY_DOMAINS = ["unah.hn", "unah.edu.hn"] as const;
export type UniversityDomain = (typeof UNIVERSITY_DOMAINS)[number];

export type FederatedEmailError =
  | "domain-not-allowed"
  | "use-microsoft-login";

export type FederatedEmailDecision =
  | {
      allowed: true;
      role: Extract<Role, "student" | "observer" | "external">;
      domain: string | null;
      universityDomain: UniversityDomain | null;
    }
  | { allowed: false; error: FederatedEmailError };

/**
 * Extract the exact domain after the last `@`.
 *
 * The comparison is deliberately strict: subdomains such as
 * `x.unah.hn` and suffixes such as `unah.hn.evil.com` are not university
 * addresses.
 */
export function emailDomain(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) {
    return null;
  }
  if (normalized.indexOf("@") !== at) {
    return null;
  }
  const domain = normalized.slice(at + 1);
  if (/\s/.test(domain)) {
    return null;
  }
  return domain;
}

export function universityDomainOf(email: string): UniversityDomain | null {
  const domain = emailDomain(email);
  return domain === "unah.hn" || domain === "unah.edu.hn" ? domain : null;
}

export function isUniversityEmail(email: string): boolean {
  return universityDomainOf(email) !== null;
}

/**
 * Decide which role an email address earns at a federated provider.
 *
 * Microsoft is the only provider allowed for university addresses. Google and
 * Apple are for applicants (`external`). Any look-alike domain is rejected.
 */
export function decideFederatedEmail(
  provider: FederatedProvider,
  email: string,
): FederatedEmailDecision {
  const domain = emailDomain(email);
  const universityDomain = universityDomainOf(email);

  if (provider === "microsoft") {
    if (universityDomain === "unah.hn") {
      return { allowed: true, role: "student", domain, universityDomain };
    }
    if (universityDomain === "unah.edu.hn") {
      return { allowed: true, role: "observer", domain, universityDomain };
    }
    return { allowed: false, error: "domain-not-allowed" };
  }

  if (universityDomain !== null) {
    return { allowed: false, error: "use-microsoft-login" };
  }

  return {
    allowed: true,
    role: "external",
    domain,
    universityDomain: null,
  };
}
