import { describe, expect, it } from "vitest";
import type { SessionAccountDto } from "@unah-red-tutores/shared";

import { authRedirect, CHANGE_PASSWORD_PATH } from "./guards";

const account: SessionAccountDto = {
  id: "1",
  email: "user@example.test",
  name: "User",
  role: "student",
  permissions: ["accounts:read"],
  status: "active",
  mustChangePassword: false,
  lastLogin: null,
};

describe("authRedirect", () => {
  it("sends anonymous visitors to login", () => {
    expect(authRedirect(null, "/admin")).toBe("/auth/login");
  });

  it("forces a password change from any other page", () => {
    const forced = { ...account, mustChangePassword: true };
    expect(authRedirect(forced, "/admin")).toBe(CHANGE_PASSWORD_PATH);
    expect(authRedirect(forced, "/admin/accounts")).toBe(CHANGE_PASSWORD_PATH);
  });

  it("allows the change-password page while the flag is set", () => {
    const forced = { ...account, mustChangePassword: true };
    expect(authRedirect(forced, CHANGE_PASSWORD_PATH)).toBeNull();
  });

  it("does not redirect a normal session", () => {
    expect(authRedirect(account, "/admin/accounts")).toBeNull();
  });
});
