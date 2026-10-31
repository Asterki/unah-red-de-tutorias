# Federated login

Accounts can sign in with Microsoft (employees and students), Google or Apple
(applicants), or with email and password. All methods share the same session and
the same role system.

## What users see

- **Empleado o Estudiante** — Microsoft only, for `@unah.hn` and
  `@unah.edu.hn` addresses.
- **Soy Aspirante** — Google and Apple, for applicants without a UNAH address.
- **Email and password** — a separate link below the provider buttons.

Only configured providers appear. If a section is empty, that provider is not
enabled on this deployment; ask the operator to complete its environment
variables.

## Rules

- Microsoft is accepted only from tenants listed in the deployment's allowlist.
- The email domain must be exactly `unah.hn` or `unah.edu.hn` for Microsoft.
  Look-alike domains are rejected.
- Google and Apple reject UNAH addresses and must assert a verified email.
- New Microsoft accounts become `student` (`@unah.hn`) or `observer`
  (`@unah.edu.hn`). New Google/Apple accounts become `external`.
- Existing roles never change at login.
- Locked, banned and inactive accounts cannot sign in.

## Placeholder identifiers

Federated accounts are created with a placeholder identifier
(`pending:<id>`) because providers do not supply the institutional number. An
administrator should open **Accounts** and replace it with the real
`account_number`, `employee_id` or `passport` value.

## Troubleshooting

The login page shows a localized message for each failure:

| Message code | Action |
|---|---|
| `tenant-not-allowed` | The Microsoft tenant is not allowlisted. Ask the administrator to add the institution's tenant ID. |
| `domain-not-allowed` | Use a `@unah.hn` or `@unah.edu.hn` Microsoft account. |
| `use-microsoft-login` | UNAH addresses must use the Microsoft button. |
| `email-not-verified` | Verify the email at the provider, then retry. |
| `account-locked` / `account-banned` / `account-inactive` | Contact an administrator. |
| `provider-error` | Retry. If it persists, check the API logs for the provider and outcome. |
| `invalid-state` | Start the login again; the attempt expired. |

Provider setup and exact callback URLs are documented for operators in the
developer documentation, `docs/auth/provider-setup.md`.
