import type { SessionAccountDto } from "@unah-red-tutores/shared";

export const CHANGE_PASSWORD_PATH = "/admin/change-password";

/**
 * Return the redirect target for the current session, or null to continue.
 * A forced password change wins over every other guarded page.
 */
export function authRedirect(
  account: SessionAccountDto | null,
  pathname: string,
): string | null {
  if (!account) {
    return "/auth/login";
  }
  if (account.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
    return CHANGE_PASSWORD_PATH;
  }
  return null;
}
