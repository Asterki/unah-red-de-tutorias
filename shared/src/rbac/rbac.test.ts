import { describe, expect, it } from "vitest";

import { ROLE_PERMISSIONS } from "./matrix.js";
import { canAssignRole, canManage, roleHasPermission } from "./policy.js";
import {
  isPermission,
  PERMISSIONS,
  type Permission,
} from "./permissions.js";
import { isRole, ROLE_RANK, ROLES, type Role } from "./roles.js";

const expected: Record<Role, readonly Permission[]> = {
  tech_admin: PERMISSIONS,
  general_admin: PERMISSIONS,
  campus_admin: [
    "accounts:read",
    "accounts:update",
    "accounts:update-status",
    "accounts:change-password",
    "roles:read",
    "docs:read",
  ],
  tutor: ["docs:read"],
  student: ["docs:read"],
  external: ["docs:read"],
  observer: ["docs:read"],
};

describe("role permission matrix", () => {
  for (const role of ROLES) {
    for (const permission of PERMISSIONS) {
      it(`${role} ${expected[role].includes(permission) ? "has" : "lacks"} ${permission}`, () => {
        expect(roleHasPermission(role, permission)).toBe(
          expected[role].includes(permission),
        );
      });
    }
  }

  it("tech_admin has every permission explicitly, without a wildcard", () => {
    expect(ROLE_PERMISSIONS.tech_admin).toEqual([...PERMISSIONS]);
    for (const permission of PERMISSIONS) {
      expect(roleHasPermission("tech_admin", permission)).toBe(true);
    }
    expect(PERMISSIONS).not.toContain("*");
  });

  it("students cannot read accounts", () => {
    expect(roleHasPermission("student", "accounts:read")).toBe(false);
  });

  it("campus admins can read but cannot create accounts", () => {
    expect(roleHasPermission("campus_admin", "accounts:read")).toBe(true);
    expect(roleHasPermission("campus_admin", "accounts:create")).toBe(false);
    expect(roleHasPermission("campus_admin", "accounts:delete")).toBe(false);
  });
});

describe("runtime guards", () => {
  it("recognises every role and rejects anything else", () => {
    for (const role of ROLES) {
      expect(isRole(role)).toBe(true);
    }
    for (const value of ["admin", "Admin", "", null, undefined, 1, {}]) {
      expect(isRole(value)).toBe(false);
    }
  });

  it("recognises every permission and rejects anything else", () => {
    for (const permission of PERMISSIONS) {
      expect(isPermission(permission)).toBe(true);
    }
    for (const value of ["accounts:write", "*", "", null, undefined, 1, {}]) {
      expect(isPermission(value)).toBe(false);
    }
  });
});

describe("management rules", () => {
  const rankOrder = [...ROLES].sort((a, b) => ROLE_RANK[a] - ROLE_RANK[b]);

  for (const actor of ROLES) {
    for (const target of ROLES) {
      it(`${actor} ${ROLE_RANK[actor] < ROLE_RANK[target] ? "can" : "cannot"} manage ${target}`, () => {
        expect(canManage(actor, target)).toBe(
          ROLE_RANK[actor] < ROLE_RANK[target],
        );
        expect(canAssignRole(actor, target)).toBe(
          ROLE_RANK[actor] < ROLE_RANK[target],
        );
      });
    }
  }

  it("tech_admin cannot manage another tech_admin", () => {
    expect(canManage("tech_admin", "tech_admin")).toBe(false);
  });

  it("general_admin cannot manage a general_admin or a tech_admin", () => {
    expect(canManage("general_admin", "general_admin")).toBe(false);
    expect(canManage("general_admin", "tech_admin")).toBe(false);
    expect(canManage("general_admin", "campus_admin")).toBe(true);
  });

  it("ranks are ordered strongest to weakest", () => {
    expect(rankOrder).toEqual([
      "tech_admin",
      "general_admin",
      "campus_admin",
      "tutor",
      "student",
      "external",
      "observer",
    ]);
  });
});
