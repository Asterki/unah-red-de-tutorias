export const ROLES = [
  "tech_admin",
  "general_admin",
  "campus_admin",
  "tutor",
  "student",
  "external",
  "observer",
] as const;

export type Role = (typeof ROLES)[number];

/** Lower rank means a stronger role. */
export const ROLE_RANK = {
  tech_admin: 0,
  general_admin: 1,
  campus_admin: 2,
  tutor: 3,
  student: 4,
  external: 5,
  observer: 6,
} as const satisfies Record<Role, number>;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
