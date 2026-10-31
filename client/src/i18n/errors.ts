import type { TFunction } from "i18next";

export type TranslatableError = {
  code?: string;
  message?: string;
};

/**
 * Single mapping from server/client error codes to `errors.codes.*` keys.
 * Anything unknown stays user-friendly instead of leaking a raw code.
 */
const API_ERROR_KEYS: Record<string, string> = {
  "network-error": "codes.networkError",
  "internal-error": "codes.internalError",
  internal_error: "codes.internalError",
  "not-found": "codes.notFound",
  not_found: "codes.notFound",
  forbidden: "codes.forbidden",
  unauthorized: "codes.unauthorized",
  unauthenticated: "codes.unauthorized",
  conflict: "codes.conflict",
  validation_error: "codes.validationError",
  "service-unavailable": "codes.serviceUnavailable",
  "password-change-required": "codes.passwordChangeRequired",
  "account-not-found": "codes.accountNotFound",
  "email-in-use": "codes.emailInUse",
  "last-admin": "codes.lastAdmin",
  "cannot-manage-self": "codes.cannotManageSelf",
  "cannot-manage-account": "codes.cannotManageAccount",
  "role-cannot-be-assigned": "codes.roleCannotBeAssigned",
  "invalid-current-password": "codes.invalidCurrentPassword",
  "invalid-origin": "codes.invalidOrigin",
  "invalid-origin-secret": "codes.invalidOriginSecret",
  "invalid-csrf-token": "codes.invalidCsrfToken",
  "invalid-credentials": "codes.invalidCredentials",
};

export function apiErrorKey(error: TranslatableError): string {
  return (
    (error.code ? API_ERROR_KEYS[error.code] : undefined) ??
    (error.message ? API_ERROR_KEYS[error.message] : undefined) ??
    "codes.unknown"
  );
}

/** Translate any normalised API error through the shared lookup. */
export function translateApiError(
  t: TFunction,
  error: TranslatableError,
): string {
  return t(apiErrorKey(error));
}

/** Translate a validation issue code, falling back to the raw message. */
export function translateValidationError(
  t: TFunction,
  message: string | undefined,
): string {
  if (!message) return t("unknown", { ns: "validation" });
  return t(message, { ns: "validation", defaultValue: message });
}
