const roles = {
  title: "Roles & Permissions",
  description:
    "Roles and permissions are defined in code. This view is read-only.",
  table: {
    role: "Role",
    permissions: "Permissions",
  },
  names: {
    tech_admin: "Technology Administrator",
    general_admin: "General Administrator",
    campus_admin: "Campus Administrator",
    tutor: "Tutor",
    student: "Student",
    external: "Applicant",
    observer: "Observer",
  },
  permissions: {
    accounts: {
      read: "Read accounts",
      create: "Create accounts",
      update: "Update accounts",
      "update-status": "Update account status",
      "change-password": "Change passwords",
      delete: "Delete accounts",
      restore: "Restore accounts",
    },
    roles: {
      read: "Read roles",
    },
    docs: {
      read: "Read documentation",
    },
  },
};

export default roles;
