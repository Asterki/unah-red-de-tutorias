# Federated login

The platform supports three OAuth/OIDC login methods on top of the existing
email + password login:

| Section | Provider | Intended audience |
|---|---|---|
| Empleado o Estudiante | Microsoft Entra ID | UNAH staff and students |
| Soy Aspirante | Google | Applicants |
| Soy Aspirante | Apple | Applicants |

Email + password keeps working unchanged and remains available from the login
page through a separate link. Federated login uses the same server session as
password login: the `sessions` table, `req.login`, the CSRF middleware and
`lastLogin` are shared. There is no second session system and no provider token
is stored.

## Architecture

```text
Browser ──GET /api/auth/<provider>──▶ API
         ◀──302 to provider + state cookie
Browser ──authorization──▶ Provider
         ◀──302 callback (GET, or POST for Apple)
Browser ──callback──▶ API Passport strategy
                      ├─ verify ID token (Microsoft, Apple)
                      ├─ build a FederatedProfile
                      ├─ federated-auth service
                      │   ├─ existing identity → update lastUsedAt/lastLogin
                      │   ├─ existing live email → link identity
                      │   └─ new email → create account + identity
                      └─ regenerate session, req.login, redirect
Browser ──▶ AUTH_SUCCESS_REDIRECT (or AUTH_FAILURE_REDIRECT?error=<code>)
```

Key files:

- `shared/src/domain/federated-email.ts` — pure, Prisma-free email/domain rules.
- `server/src/auth/providers.ts` — which providers are enabled and their
  callback URLs.
- `server/src/auth/strategies.ts` — Passport strategy registration and ID-token
  verification.
- `server/src/auth/oauth-state.ts` — signed, short-lived OAuth `state` cookie.
- `server/src/services/federated-auth.service.ts` — account lookup, linking and
  creation.
- `server/src/controllers/federated-auth.ts` — begin/callback handlers and
  redirects.
- `server/src/routes/auth.ts` — public routes.

## Flows

1. `GET /api/auth/providers` returns the providers whose complete configuration
   is present. The login page renders only those buttons.
2. A button navigates the whole page to `/api/auth/<provider>`.
3. The API creates a random `state`, signs it with `SESSION_SECRET`, stores it
   in a `SameSite=None; Secure; HttpOnly` cookie scoped to `/api/auth`, and
   redirects to the provider. The state cookie, not the session cookie, carries
   the state because Apple's cross-site `form_post` callback does not send
   `SameSite=Lax` cookies.
4. The callback validates the state from the query (Microsoft/Google) or form
   body (Apple), then runs the Passport strategy.
5. On success the API regenerates the session, calls `req.login`, updates
   `lastLogin` and redirects to `AUTH_SUCCESS_REDIRECT`. On failure it redirects
   to `AUTH_FAILURE_REDIRECT?error=<code>`.

The callbacks never return JSON. Error details and provider tokens are never
returned to the browser or written to logs; only the provider, outcome and
stable error code are logged.

### State, nonce and PKCE

- Every provider flow uses the signed `state` cookie described above.
- Microsoft and Apple ID tokens are verified against the provider JWKS, with
  issuer and audience checks.
- The strategies in use do not expose a PKCE verifier hook; PKCE is therefore
  not enabled. Confidential clients authenticate with their client secret (or
  Apple private key), and state + ID-token signature provide the CSRF/replay
  protection.

## Role assignment

Roles are assigned only when an account is created. Logging in never changes the
role of an existing account.

| Provider | Email domain | Role | Placeholder `idType` |
|---|---|---|---|
| Microsoft | `unah.hn` | `student` | `account_number` |
| Microsoft | `unah.edu.hn` | `observer` | `employee_id` |
| Google | anything except the two UNAH domains | `external` | `passport` |
| Apple | anything except the two UNAH domains | `external` | `passport` |

The comparison is exact after the last `@` and case-insensitive. Subdomains and
look-alikes (`x.unah.hn`, `unah.hn.evil.com`) are rejected.

### Microsoft tenant allowlist

Microsoft is accepted only when the ID token `tid` claim is listed in
`MICROSOFT_ALLOWED_TENANT_IDS`. The email claim alone is not trusted. The
authority is multi-tenant (`organizations`), so any Entra tenant can start the
flow, but only allowlisted tenants complete it.

## Account creation and linking

1. Look up `AccountIdentity` by `(provider, providerUserId)`.
   - Found: reject if the account is soft-deleted or not `active`; otherwise
     update `lastUsedAt` and `lastLogin` and sign in.
2. Validate the provider rules first (tenant, domain, verified email).
3. Look up a live account by lowercase email (`deletedAt IS NULL`).
   - Found: link the identity to it. Existing roles are unchanged.
   - Not found: create the account, its metadata row, one role, the identity and
     the audit history in one transaction.
4. Google and Apple with the same email resolve to the same account, with one
   identity per provider.

Soft-deleted accounts never match: their email has already been replaced by a
one-way hash. Signing in with that address creates a new account.

If Apple returns a private relay address (`@privaterelay.appleid.com`), it is
stored as-is. Apple only sends the name on the first authorization; when it is
missing, the account name falls back to the email local part.

### Placeholder identifiers

Providers do not return the institutional identifier. New federated accounts
are created with `identifier = "pending:<cuid>"` and the `idType` from the table
above. An administrator can complete the real value in **Accounts**. There is no
self-service profile-completion flow yet.

## Account status rules

Federated login is rejected when the account is not `active`:

| Status | Error code |
|---|---|
| `locked` | `account-locked` |
| `banned` | `account-banned` |
| `inactive` | `account-inactive` |
| soft-deleted | `account-inactive` |

Password login also refuses a null password (federated-only accounts) and
non-active statuses.

## Error codes

| Code | Meaning |
|---|---|
| `tenant-not-allowed` | Microsoft tenant is not in `MICROSOFT_ALLOWED_TENANT_IDS`. |
| `domain-not-allowed` | Microsoft email is not exactly `unah.hn` or `unah.edu.hn`. |
| `use-microsoft-login` | Google/Apple email or Google `hd` uses a UNAH domain. |
| `email-not-verified` | Google/Apple did not assert a verified email. |
| `account-locked` | Account status is `locked`. |
| `account-banned` | Account status is `banned`. |
| `account-inactive` | Account status is `inactive` or soft-deleted. |
| `provider-error` | Provider did not return a usable profile, or an unexpected failure. |
| `invalid-state` | Missing, expired or forged OAuth state. |

The login page maps each code to a localized message.

## Development and the origin secret

When `ORIGIN_SECRET` is set, every `/api/*` request normally needs a matching
`x-origin-secret` header, which the Vite dev proxy and the production Vercel
rewrite inject. OAuth is special only in development: the browser follows the
provider redirects directly to the API, bypassing the Vite proxy, so those
requests arrive without the header.

The server therefore skips the origin-secret check only when **all** of these
are true:

- `NODE_ENV` is exactly `development` (the Zod-parsed config, not
  `process.env`); `test`, `staging` and `production` never bypass.
- The method and path match one of these exact pairs:
  `GET /api/auth/microsoft`, `GET /api/auth/microsoft/callback`,
  `GET /api/auth/google`, `GET /api/auth/google/callback`,
  `GET /api/auth/apple`, or `POST /api/auth/apple/callback`.

Nothing else is exempt: account, docs and provider-list routes still require
the secret in development. Production must always send OAuth through the
proxy; the bypass cannot be enabled there by configuration. A warning is
logged once at startup when the bypass is active:

```text
origin-secret bypass active for OAuth routes (development only)
```

## Troubleshooting

| Symptom | Check |
|---|---|
| Provider button is missing | All env vars for that provider must be set, then restart the API. `GET /api/auth/providers` shows the enabled list. |
| `redirect_uri_mismatch` | The callback URL registered at the provider must exactly match `AUTH_CALLBACK_BASE_URL` + `/api/auth/<provider>/callback`, including scheme and trailing path. |
| Redirected with `invalid-state` | The state cookie is missing or older than 10 minutes. Check HTTPS, `SameSite=None`, clock skew and that the API origin is the same one that started the flow. |
| Microsoft always `tenant-not-allowed` | Copy each institution's tenant ID (GUID), not its domain name, into `MICROSOFT_ALLOWED_TENANT_IDS`. |
| Microsoft login has no email | Add the optional `email` claim in the Entra app registration and grant admin consent. |
| Apple works in production but not locally | Apple requires an HTTPS return URL. Use a tunnel and set `AUTH_CALLBACK_BASE_URL` to it. |
| `account-inactive` for a known user | The account is soft-deleted or has status `inactive`; an administrator must restore/reactivate it or the user registers again. |
| Provider says app is unverified | Complete Google OAuth consent-screen verification, or add the account as a test user while in testing. |
