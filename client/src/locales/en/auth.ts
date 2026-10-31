const auth = {
  login: {
    title: "Sign in",
    description: "Choose how you want to sign in to continue.",
    employeeTitle: "Employee or Student",
    employeeDescription:
      "Use your institutional Microsoft account to access the platform.",
    applicantTitle: "I'm an Applicant",
    applicantDescription:
      "Use your Google or Apple account to request tutoring sessions.",
    microsoft: "Continue with Microsoft",
    google: "Continue with Google",
    apple: "Continue with Apple",
    noProviders: "No federated sign-in method is configured yet.",
    errorTitle: "We could not sign you in",
    passwordDivider: "or",
    passwordTitle: "Sign in with email and password",
    passwordButton: "Use email and password",
  },
  password: {
    title: "Sign in",
    description: "Enter your credentials to continue.",
    fields: {
      email: "Email",
      emailPlaceholder: "Enter your email",
      password: "Password",
      passwordPlaceholder: "Enter your password",
    },
    submit: "Sign in",
    back: "Back to all sign-in options",
    messages: {
      success: "Signed in successfully.",
    },
  },
  logout: {
    title: "Sign out",
    description: "Are you sure you want to sign out?",
    button: "Sign out",
    cancel: "Cancel",
  },
  changePassword: {
    title: "Change Password",
    description: "Update the password for your own account.",
    forcedTitle: "Password change required",
    forcedDescription:
      "You must change the initial password before using the rest of the system.",
    fields: {
      currentPassword: "Current password",
      newPassword: "New password (at least 12 characters)",
      confirmPassword: "Confirm new password",
    },
    messages: {
      success: "Password updated.",
      mismatch: "The passwords do not match.",
    },
  },
};

export default auth;
