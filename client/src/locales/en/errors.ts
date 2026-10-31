const errors = {
  "404": {
    title: "Page not found",
    description: "The page you are looking for does not exist.",
    back: "Back to home",
  },
  offline: {
    title: "Offline",
    subtitle:
      "Could not connect to the server. Features that require a connection will be unavailable.",
    retry: "Retry",
  },
  boundary: {
    title: "Something went wrong",
    description:
      "An unexpected error occurred while rendering this page. You can retry the operation.",
    retry: "Retry",
  },
  codes: {
    unknown: "An unexpected error occurred. Please try again.",
    networkError:
      "Could not connect to the server. Check your connection and try again.",
    internalError: "An internal error occurred. Please try again.",
    forbidden: "You do not have permission for this page or action.",
    unauthorized: "Your session expired. Sign in again.",
    notFound: "The requested resource was not found.",
    conflict: "The operation conflicts with the current state.",
    validationError: "The request contains invalid values.",
    serviceUnavailable: "The service is unavailable right now.",
    passwordChangeRequired: "You must change your password before continuing.",
    accountNotFound: "The account was not found.",
    emailInUse: "That email address is already in use.",
    lastAdmin: "The last administrator cannot be deleted, disabled or demoted.",
    cannotManageSelf: "You cannot manage your own account from this section.",
    cannotManageAccount: "You cannot manage an account with this role.",
    roleCannotBeAssigned: "You cannot assign a role equal to or above your own.",
    invalidCurrentPassword: "The current password is incorrect.",
    invalidOrigin: "The request origin is not allowed.",
    invalidOriginSecret: "The request origin is not allowed.",
    invalidCsrfToken: "The security token is invalid. Reload the page.",
    invalidCredentials: "Invalid credentials.",
    domainNotAllowed:
      "Only @unah.hn and @unah.edu.hn Microsoft accounts can sign in this way.",
    tenantNotAllowed:
      "Your Microsoft organization is not authorized to use this platform.",
    useMicrosoftLogin:
      "Institutional accounts must sign in with Microsoft under \"Employee or Student\".",
    accountLocked: "This account is locked. Contact an administrator.",
    accountBanned: "This account is banned. Contact an administrator.",
    accountInactive: "This account is inactive. Contact an administrator.",
    emailNotVerified:
      "Your provider has not verified this email address, so we cannot sign you in.",
    providerError:
      "The identity provider could not complete the sign-in. Please try again.",
    invalidState:
      "The sign-in attempt expired or was invalid. Please start again.",
  },
};

export default errors;
