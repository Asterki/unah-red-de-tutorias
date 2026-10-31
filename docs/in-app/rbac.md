# Roles and permissions

Roles are fixed by the application code and stored as a Prisma enum. They
cannot be edited from the UI.

| Role | Main capabilities |
|---|---|
| `tech_admin` | Everything, including every permission added later. |
| `general_admin` | Full account, role and documentation administration. |
| `campus_admin` | Read and update accounts, change status or passwords, read roles and docs. |
| `tutor` | Read documentation. |
| `student` | Read documentation. |
| `external` | Read documentation; applicant accounts created by Google or Apple. |
| `observer` | Read documentation; institutional staff accounts created by Microsoft. |

## Rules

- A stronger role can only manage accounts whose role is strictly below it.
  General admins cannot edit, reset, disable or delete other general admins or
  tech admins.
- Nobody can manage their own account through the admin endpoints. Use
  **Change password** for your own password.
- The last active `tech_admin` cannot be deleted, demoted or disabled. Create or
  promote another tech admin first.
- While an account has a bootstrap password, only the password-change, login,
  logout, CSRF and profile routes work. Change the password first.

## Federated accounts

Accounts created through Microsoft, Google or Apple have no password. Roles are
assigned on creation (`student` for `@unah.hn`, `observer` for
`@unah.edu.hn`, `external` for applicants) and never change at login. Their
identifier starts with `pending:`; replace it in **Accounts** with the real
institutional value.

## Requesting a change

Ask an administrator to change a role in **Accounts**. A new role or permission
is a code change plus a database migration; it is not a runtime setting. See the
developer documentation for the exact files.
