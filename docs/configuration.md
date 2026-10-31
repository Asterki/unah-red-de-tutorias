# Configuration

Each package reads its own environment file. Start from the committed examples:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

`server/.env` and `client/.env` are ignored by git. Only `*.env.example` files
are committed. Never put real credentials in an example.

## Server (`server/.env`)

The server parses this file with a Zod schema (`server/src/config/env.ts`) and
exits with a field-level error when configuration is invalid. `ENV_FILE` can
point to another file; otherwise `server/.env` is loaded when it exists.

| Name | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development`, `test` or `production`. Controls cookie prefix/flags and the default log format. |
| `PORT` | no | `3000` | HTTP port (1-65535). Compose publishes this port. |
| `DATABASE_URL` | **yes** | none | Runtime DSN. Must start with `mysql://` or `mariadb://`. Use the DML-only user. |
| `MIGRATE_DATABASE_URL` | no | `DATABASE_URL` | DDL DSN for Prisma Migrate and the `migrate` job. |
| `DB_POOL_LIMIT` | no | `10` | MariaDB adapter pool size. |
| `SESSION_SECRET` | **yes** | none | Session and cookie signing; at least 32 characters. |
| `CORS_ORIGINS` | no (required in production) | empty | Comma-separated exact browser origins. Used by CORS and the CSRF Origin check. |
| `TRUST_PROXY` | no | `0` | Number of trusted proxy hops. Use `1` for a direct Vercel rewrite. |
| `ORIGIN_SECRET` | no | unset | When set, `/api/*` requires a matching `x-origin-secret`. Vercel injects it. |
| `SERVE_CLIENT` | no | `false` | Serve `CLIENT_DIR` and the SPA fallback from the API. |
| `CLIENT_DIR` | no | `client-dist` | Directory containing the built SPA when `SERVE_CLIENT=true`. |
| `LOG_LEVEL` | no | `info` | `trace`, `debug`, `info`, `warn`, `error`, `fatal` or `silent`. |
| `LOG_FORMAT` | no | `json` in production, `pretty` otherwise | `json` or `pretty`. |
| `SERVICE_NAME` | no | `unah-red-tutores-api` | Value of the `service` field in every log line. |
| `OTEL_ENABLED` | no | `false` | Enable the optional OpenTelemetry SDK. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | when tracing | none | OTLP HTTP endpoint (a valid URL). |
| `OTEL_SERVICE_NAME` | no | `SERVICE_NAME` | Service name reported to the trace backend. |
| `RATE_LIMIT_WINDOW_MS` | no | `900000` | Global rate-limit window (15 minutes). |
| `RATE_LIMIT_MAX` | no | `300` | Requests per window per client IP. |
| `LOGIN_RATE_LIMIT_MAX` | no | `10` | Login attempts per window per client IP. |
| `BOOTSTRAP_ADMIN_EMAIL` | first seed | none | Email of the first administrator. Required when no accounts exist. |
| `BOOTSTRAP_ADMIN_PASSWORD` | no | generated | First administrator password. Leave empty to print a one-time password. |
| `BOOTSTRAP_ADMIN_NAME` | no | `Administrator` | Display name of the first administrator. |
| `DOCS_DIR` | no | `docs/in-app` | Directory containing the allowlisted in-app markdown pages. |
| `COOKIE_DOMAIN` | no | empty | Optional cookie `Domain`. Leave empty for `__Host-` cookies. |
| `SOFT_DELETE_HASH_KEY` | production | `SESSION_SECRET` | HMAC key that replaces unique values of soft-deleted rows. Keep it stable; it is one-way. |
| `AUTH_CALLBACK_BASE_URL` | when federated | `http://localhost:PORT` | Public origin used to build OAuth callback URLs. |
| `AUTH_SUCCESS_REDIRECT` | no | `/` | Client path after a successful federated login. |
| `AUTH_FAILURE_REDIRECT` | no | `/auth/login` | Client path after a failed federated login; receives `?error=<code>`. |
| `MICROSOFT_CLIENT_ID` | when Microsoft | unset | Entra app registration client ID. |
| `MICROSOFT_CLIENT_SECRET` | when Microsoft | unset | Entra client secret value. |
| `MICROSOFT_ALLOWED_TENANT_IDS` | when Microsoft | empty | Comma-separated Entra tenant ID allowlist. |
| `GOOGLE_CLIENT_ID` | when Google | unset | Google OAuth web client ID. |
| `GOOGLE_CLIENT_SECRET` | when Google | unset | Google OAuth web client secret. |
| `APPLE_CLIENT_ID` | when Apple | unset | Apple **Services ID**, not the App ID. |
| `APPLE_TEAM_ID` | when Apple | unset | Apple Developer Team ID. |
| `APPLE_KEY_ID` | when Apple | unset | Key ID of the Sign in with Apple `.p8` key. |
| `APPLE_PRIVATE_KEY` | when Apple | unset | `.p8` contents with escaped newlines. Takes precedence over the path. |
| `APPLE_PRIVATE_KEY_PATH` | when Apple | unset | Path to the `.p8` file instead of inline contents. |

Each federated provider is enabled only when all of its variables are present.
With none configured the app still boots, `GET /api/auth/providers` returns an
empty list and provider routes return `404`. See
[Federated login](auth/federated-login.md) and
[Provider setup](auth/provider-setup.md).

The bootstrap password is used only by the seed CLI. It is printed at most once
and is never written to the logger, the database history or an HTTP response.
The new administrator must change it on first login.

### Database pool setting

The pool size is **not** a URL parameter. It is passed to the MariaDB adapter as
`connectionLimit` in `server/src/db/prisma.ts`, using `DB_POOL_LIMIT`. This was
confirmed in [ADR 0001](decisions/0001-package-layout.md): the driver adapter
receives a `mariadb.PoolConfig` and does not parse `?connection_limit=` from the
DSN.

### Command-line overrides

`ENV_FILE=/absolute/or/relative/path npm --prefix server run db:deploy` loads a
different file. Prisma Migrate uses `MIGRATE_DATABASE_URL`, falling back to
`DATABASE_URL`.

## Client (`client/.env`)

Vite exposes only `VITE_*` variables at build time.

| Name | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `/api` | Browser API base. Keep `/api` on Vercel. |
| `VITE_APP_NAME` | shared `APP_NAME` | Brand name in the header, title and PWA manifest. |
| `VITE_APP_SLUG` | shared `APP_SLUG` | Machine-readable brand slug. |
| `VITE_BRAND_COLOR` | shared `BRAND_COLOR` | Six-digit hex brand colour. Invalid values fall back. |
| `VITE_DEFAULT_LOCALE` | `en` | `en` or `es`. An unknown value falls back to `en`. |
| `ORIGIN_SECRET` | empty | Development proxy only. Vite injects it as `x-origin-secret`; never prefix it with `VITE_`. |
| `VITE_PROXY_TARGET` | `http://localhost:3000` | Target for the Vite `/api` development proxy. |

The defaults come from `shared/src/config/app.ts`. `npm run init` rewrites
those defaults so a new project does not depend on deployment-time overrides.
In development Vite proxies `/api` to `VITE_PROXY_TARGET` and injects the
optional `ORIGIN_SECRET`. In production the Vercel rewrite performs the same
job, so `VITE_API_URL` stays `/api`.

## Compose variables

`compose.dev.yaml` reads `server/.env`; `compose.prod.yaml` and
`compose.ghcr.yaml` read the root `.env`.

| Name | Used by | Purpose |
|---|---|---|
| `MYSQL_ROOT_PASSWORD` | all compose files | MariaDB root password for the container. |
| `MYSQL_DATABASE` | all compose files | Database created on first boot. |
| `MYSQL_USER`, `MYSQL_PASSWORD` | all compose files | Runtime database user created on first boot. |
| `DATABASE_URL`, `MIGRATE_DATABASE_URL` | API and migrate | DSNs passed to the containers. |
| `PORT` | prod and ghcr compose | Published API port (`127.0.0.1:${PORT}:${PORT}`). |
| `GHCR_OWNER`, `IMAGE_NAME`, `IMAGE_TAG` | `compose.ghcr.yaml` | Pull-only image reference. `IMAGE_TAG` defaults to `latest`. |
| `GRAFANA_ADMIN_PASSWORD` | observability overlay | Grafana admin password; default `admin` is for local use only. |

## Vercel

Set these in the Vercel project for Preview and Production as needed. They are
not read by the API container.

| Name | Purpose |
|---|---|
| `API_URL` | Public HTTPS origin of the API, without a trailing slash. Used by the `/api` rewrite. |
| `ORIGIN_SECRET` | Injected as `x-origin-secret`; must match the API value. Server-side only. |
| `VITE_API_URL` | `/api`. |
| `VITE_APP_NAME`, `VITE_APP_SLUG`, `VITE_BRAND_COLOR`, `VITE_DEFAULT_LOCALE` | Optional build-time brand overrides. |

`vercel.json` contains the install/build commands and the route list, so the
dashboard overrides should stay empty. See [deployment](deployment.md).

## CI

`.github/workflows/ci.yml` runs the server tests against a MariaDB 11.4 service
container and supplies `DATABASE_URL`, `MIGRATE_DATABASE_URL`,
`SESSION_SECRET`, `CORS_ORIGINS`, `LOG_LEVEL` and `LOG_FORMAT` explicitly. It
does not read a `.env` file.
