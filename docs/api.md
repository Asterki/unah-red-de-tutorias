# API reference

Base path: `/api`. JSON in, JSON out. The SPA uses `VITE_API_URL=/api`; on
Vercel the same path is proxied to the API.

## Authentication and CSRF

Authentication uses a server-side session stored in MariaDB. The session
cookie is `app.sid` in development and `__Host-app.sid` in production
(`HttpOnly`, `Secure` in production, `SameSite=Lax`).

1. `GET /api/auth/csrf` returns a token and sets the CSRF cookie.
2. Send the token in `x-csrf-token` on every `POST`, `PATCH` and `DELETE`.
3. The browser sends the session cookie automatically (`withCredentials`).

Requests with an `Origin` header on an unsafe method must come from an origin
listed in `CORS_ORIGINS`. When `ORIGIN_SECRET` is set, every `/api/*` request
must also send `x-origin-secret`, except the exact OAuth start/callback routes
in `NODE_ENV=development` (see [Federated login](auth/federated-login.md#development-and-the-origin-secret)).

The client's single axios instance in `client/src/utils/api.ts` performs steps
1 and 2 automatically.

## Health

These routes are mounted before sessions, CSRF, rate limiting and the origin
secret.

| Method | Path | Auth | Response |
|---|---|---|---|
| `GET` | `/healthz` | public | `200 {"status":"ok"}` |
| `GET` | `/readyz` | public | `200 {"status":"ready"}` or `503 {"status":"degraded"}` |

## Auth

| Method | Path | Permission | Request | Success response |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | public (rate limited) | `{ "email": string, "password": string }` | `200 { "data": SessionAccountDto }` |
| `GET` | `/api/auth/csrf` | public | — | `200 { "csrfToken": string }` |
| `POST` | `/api/auth/logout` | authenticated | — | `200 { "data": { "success": true } }` |
| `GET` | `/api/auth/me` | authenticated | — | `200 { "data": SessionAccountDto }` |
| `POST` | `/api/auth/change-password` | authenticated | `{ "currentPassword": string, "newPassword": string }` | `200 { "data": SessionAccountDto }` |
| `GET` | `/api/auth/providers` | public (rate limited) | — | `200 { "data": { "providers": FederatedProvider[] } }` |
| `GET` | `/api/auth/microsoft` | public (rate limited) | — | `302` to Microsoft |
| `GET` | `/api/auth/microsoft/callback` | public (rate limited) | OAuth `code` + `state` | `302` to the success/failure redirect |
| `GET` | `/api/auth/google` | public (rate limited) | — | `302` to Google |
| `GET` | `/api/auth/google/callback` | public (rate limited) | OAuth `code` + `state` | `302` to the success/failure redirect |
| `GET` | `/api/auth/apple` | public (rate limited) | — | `302` to Apple |
| `POST` | `/api/auth/apple/callback` | public (rate limited) | `form_post` body (`code`, `state`, `id_token`) | `302` to the success/failure redirect |

Federated callbacks never return JSON. Failures redirect to
`AUTH_FAILURE_REDIRECT?error=<code>`; the codes are `tenant-not-allowed`,
`domain-not-allowed`, `use-microsoft-login`, `email-not-verified`,
`account-locked`, `account-banned`, `account-inactive`, `provider-error` and
`invalid-state`. See [Federated login](auth/federated-login.md).

`SessionAccountDto`:

```json
{
  "id": "cuid",
  "email": "user@example.com",
  "name": "User",
  "role": "student",
  "permissions": ["docs:read"],
  "status": "active",
  "mustChangePassword": false,
  "lastLogin": "2026-10-29T12:00:00.000Z"
}
```

`lastLogin` is `null` before the first login. `permissions` is computed from the
shared role matrix and is not stored in the database.

After login, passwords are rehashed to bcrypt cost 12 when the stored hash uses
a different cost. `mustChangePassword=true` blocks every other route except the
five self-service auth routes until the password is changed.

## Accounts

All account routes require authentication plus the permission shown.

| Method | Path | Permission | Request | Success response |
|---|---|---|---|---|
| `GET` | `/api/accounts` | `accounts:read` | Query: `page`, `pageSize`, `search`, `role`, `status`, `includeDeleted` | `200 { "data": AccountDto[], "meta": PageMeta }` |
| `GET` | `/api/accounts/:id` | `accounts:read` | — | `200 { "data": AccountDto }` |
| `POST` | `/api/accounts` | `accounts:create` | `{ "email", "name", "idType", "identifier", "password", "role" }` | `201 { "data": AccountDto }` |
| `PATCH` | `/api/accounts/:id` | `accounts:update` | `{ "email"?, "name"?, "idType"?, "identifier"?, "role"? }` (at least one) | `200 { "data": AccountDto }` |
| `POST` | `/api/accounts/:id/status` | `accounts:update-status` | `{ "status": "active" \| "inactive" }` | `200 { "data": AccountDto }` |
| `POST` | `/api/accounts/:id/password` | `accounts:change-password` | `{ "newPassword": string }` | `200 { "data": AccountDto }` |
| `DELETE` | `/api/accounts/:id` | `accounts:delete` | — | `200 { "data": AccountDto }` (soft deleted) |
| `POST` | `/api/accounts/:id/restore` | `accounts:restore` | — | `200 { "data": AccountDto }` |

`AccountDto`:

```json
{
  "id": "cuid",
  "email": "user@example.com",
  "name": "User",
  "idType": "account_number",
  "identifier": "20240001",
  "role": "student",
  "status": "active",
  "mustChangePassword": false,
  "lastLogin": null,
  "createdAt": "2026-10-29T12:00:00.000Z",
  "updatedAt": "2026-10-29T12:00:00.000Z",
  "deleted": false
}
```

### Pagination and filters

`page` is 1-based and defaults to `1`; `pageSize` defaults to `20` and is capped
at `100`. `PageMeta` is `{ "page", "pageSize", "total" }`.

`search` matches name or email (maximum 100 characters). `role` accepts any of
the seven roles. `status` accepts `active`, `locked`, `banned` or `inactive`.
`includeDeleted=true` includes soft-deleted accounts.

### Policy

- A role can only be assigned by an actor who strictly outranks it
  (`canAssignRole`).
- An account can only be changed by an actor who strictly outranks its current
  role (`canManage`). Self-management is rejected.
- The last active, non-deleted `tech_admin` cannot be deleted, demoted or
  disabled.
- Soft delete replaces the email and identifier with one-way HMAC hashes and
  sets `deletedAt`/`deletedBy`. Restore clears those flags but does not recover
  the original values.
- Passwords are hashed with bcrypt cost 12. Password history stores
  `"[changed]"`, never the hash. Federated-only accounts have `password: null`.
- `POST /api/accounts/:id/password` sets `mustChangePassword=true` for the
  target. `POST /api/auth/change-password` clears it for the caller.

## In-app documentation

| Method | Path | Permission | Response |
|---|---|---|---|
| `GET` | `/api/docs` | `docs:read` | `200 [{ "slug": "index", "title": "Operator documentation" }, ...]` |
| `GET` | `/api/docs/:slug` | `docs:read` | `200 { "slug", "title", "markdown" }` |

The manifest is the allowlist in `docs/in-app/manifest.json`; the server never
scans the directory. Slugs must match `^[a-z0-9-]{1,64}$` and exist in the
manifest. The resolved file is checked with `realpath` and must stay inside the
real `DOCS_DIR`; `..`, encoded traversal, absolute paths, null bytes and
symlinks that escape the directory return `404`. Unknown slugs return `404`.
Responses are cached in memory when `NODE_ENV=production`.

## Roles

| Method | Path | Permission | Response |
|---|---|---|---|
| `GET` | `/api/roles` | `roles:read` | `200 { "data": [{ "role": "tech_admin", "permissions": [...] }] }` |

The list is read-only and comes from the shared matrix. There is no role CRUD
API.

## Error format

Every error uses:

```json
{
  "error": {
    "code": "forbidden",
    "message": "forbidden",
    "details": [],
    "traceId": "request-id"
  }
}
```

`details` is optional. `traceId` matches the `x-trace-id` response header and
the pino `req.id`. In production, stacks are logged but never returned.

| Status | Code | Meaning |
|---|---|---|
| `400` | `validation_error` | Zod validation failed; `details` lists `{ path, code, message }`. |
| `401` | `unauthorized` | No session, or invalid credentials. |
| `403` | `forbidden` | Missing permission, bad CSRF token/origin, or bad origin secret. |
| `403` | `password-change-required` | The account must change the bootstrap password first. |
| `404` | `not_found` | Unknown route, account, item or document. |
| `409` | `conflict` | Duplicate email (`email-in-use`) or another unique violation. |
| `429` | — | Login or global rate limit exceeded. `express-rate-limit` returns a plain-text response, not the JSON envelope. |
| `500` | `internal_error` | Unhandled error; details are in the logs only. |
| `503` | `service-unavailable` | Database unavailable or readiness degraded. |

Domain-specific messages that are intentionally stable include
`invalid-credentials`, `account-locked`, `invalid-current-password`,
`account-not-found`, `email-in-use`, `invalid-origin`, `invalid-csrf-token`,
`invalid-origin-secret` and `password-change-required`.

## Shared contracts

Request schemas and DTOs live in `shared/src/schemas` and `shared/src/dto`.
Response types live in `shared/src/api`. Both packages import these types, so a
contract change is visible to the server and the client at typecheck time.
