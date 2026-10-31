# AGENTS.md

Guidance for AI agents and humans working in this repository. Read this before
changing code. If a command or path disagrees with the code, the code wins;
update this file in the same change.

## Project overview

A single-tenant tutoring management platform built on an admin template. Campuses
offer courses; tutors apply, get approved for courses, publish availability and
run sessions; students request and register for sessions; admins manage it all.

- **server/**: headless Express 5 API on Node 24, Prisma 7 with MariaDB through
  `@prisma/adapter-mariadb`, session auth, pino logs, default-deny RBAC.
- **client/**: React 19 + Vite 7 + Ant Design 5 SPA, TanStack Router, i18next
  (`en` default, `es` included).
- **shared/**: Zod request schemas, DTOs, wire types, roles, permissions and
  policy. It is **Prisma-free and framework-free**.

There are three independent npm packages and no npm workspaces. The root
`package.json` has scripts only and no dependencies. Each package has its own
`package.json`, `package-lock.json` and `node_modules`.

## Commands

Run commands from the repository root unless noted.

### Root

| Purpose | Command |
|---|---|
| Install everything | `npm run bootstrap` |
| Initialise a new project | `npm run init -- --name "Acme" --slug acme --yes` |
| Diagnostics | `npm run doctor` |
| Lint all packages | `npm run lint` |
| Typecheck all packages | `npm run typecheck` |
| Test all packages | `npm run test` |
| Build all packages | `npm run build` |
| Develop API and SPA | `npm run dev` |
| Legacy export/import | `npm run legacy:export`, `npm run legacy:import` |

### shared

| Purpose | Command |
|---|---|
| Install | `npm --prefix shared install` |
| Lint | `npm --prefix shared run lint` |
| Typecheck | `npm --prefix shared run typecheck` |
| Test | `npm --prefix shared run test` |
| Build (ESM + d.ts) | `npm --prefix shared run build` |
| Coverage | `npm --prefix shared run test:coverage` |

### server

| Purpose | Command |
|---|---|
| Install | `npm --prefix server install` |
| Develop | `npm --prefix server run dev` |
| Lint | `npm --prefix server run lint` |
| Typecheck | `npm --prefix server run typecheck` |
| Test | `npm --prefix server run test` |
| Build | `npm --prefix server run build` |
| Generate Prisma client | `npm --prefix server run db:generate` |
| Validate the schema | `npm --prefix server run db:validate` |
| Apply migrations | `npm --prefix server run db:deploy` |
| Migration status | `npm --prefix server run db:status` |
| Seed first admin | `npm --prefix server run db:seed` |

Integration tests need MariaDB (`TEST_DATABASE_URL` or `DATABASE_URL`).
Without a database the integration files are skipped; CI always provides one.

### client

| Purpose | Command |
|---|---|
| Install | `npm --prefix client install` |
| Develop | `npm --prefix client run dev` |
| Lint | `npm --prefix client run lint` |
| Typecheck | `npm --prefix client run typecheck` |
| Test | `npm --prefix client run test` |
| Build | `npm --prefix client run build` |
| i18n hardcoded-string check | `npm --prefix client run check:i18n` |

The client dev server proxies `/api` to `VITE_PROXY_TARGET` and injects the
optional `ORIGIN_SECRET` from `client/.env`. Production uses the Vercel rewrite.

## Repository map

```text
client/src/
  app, components, config, features/{accounts,auth,docs,roles,...}
  layouts, locales/{en,es}, rbac, routes, theme
server/
  prisma/{schema.prisma,migrations}
  src/config       Zod env parsing
  src/db           Prisma client, transactions, audit and soft-delete helpers
  src/http         errors, validation, DTOs, pagination, error handler
  src/middleware   auth/permission, CSRF, rate limit, origin secret, logging
  src/rbac         account policy and last-admin guard
  src/routes       auth, accounts, roles, docs, health, domain routers
  src/services     one service per aggregate, plus sessions
  src/cli/seed.ts  idempotent first-admin seed
  test/            integration tests
shared/src/
  api, config, dto, rbac, schemas
docs/              MkDocs site plus in-app operator pages
scripts/           bootstrap, init, doctor, remove-example, legacy
```

## Domain model

The schema lives in `server/prisma/schema.prisma`. Summary:

| Area | Models |
|---|---|
| Identity | `Account`, `AccountIdentity`, `AccountRole` |
| Structure | `Campus` (an account belongs to at most one), `Course` (many-to-many with `Campus`), `CourseMaterial` |
| Tutor onboarding | `TutorApplication` (`requestedCourses` = what the tutor asked for, `approvedCourses` = what an admin granted), `TimeSlot` (weekly availability, time of day) |
| Sessions | `SessionRequest`, `ProgrammedSession`, `SessionRegistration`, `SessionFeedback`, `SessionReport` |
| Cross-cutting | `Metadata`, `MetadataUpdateHistory`, `Session` (auth sessions, table `sessions`) |

Rules specific to this domain:

- **`Account.idType` + `Account.identifier`** hold the person's identifier.
  `idType` (`account_number`, `employee_id`, `national_id`, `passport`) says
  what `identifier` means. They are unique together. Do not reintroduce
  `accountNumber`. `Role` is separate: it controls permissions, not identity.
- **`Account.password` is nullable.** Federated-only accounts have no password;
  the password login path must reject a null hash before calling bcrypt.
- **Federated accounts use placeholder identifiers.** Providers do not return
  the institutional number. On creation use the role mapping
  (`student` → `account_number`, `observer` → `employee_id`, `external` →
  `passport`) and `identifier = "pending:" + cuid`. An administrator completes
  the real value later; there is no self-service completion flow.
- **`AccountIdentity` is a provider link.** It is a child table (no Metadata,
  no soft delete) with `@@unique([provider, providerUserId])` and
  `@@unique([accountId, provider])`. Never store access, refresh or ID tokens.
- **`SessionFeedback` is anonymous.** It has no author column. Never add one,
  never join it to a student, and never log who wrote it. Duplicate prevention
  uses `SessionRegistration.feedbackSubmitted`.
- **`SessionReport`** is authored by a tutor (`authorId`); its timestamps come
  from `Metadata`.
- **Time slots** store `startTime`/`endTime` as time-of-day (`@db.Time(0)`)
  plus `dayOfWeek`; do not store full dates there.
- **JSON columns** (`CourseMaterial.links`) are validated with a shared Zod
  schema before they are written. MariaDB has no scalar lists.

## Federated authentication

Passport strategies live in `server/src/auth/`; the account rules live in
`server/src/services/federated-auth.service.ts`. All methods share the existing
session (`sessions` table, `req.login`, CSRF, `lastLogin`); do not add a second
session system.

- **Enabled providers are configuration-driven.** A provider is enabled only
  when every variable for it is set: Microsoft (`MICROSOFT_CLIENT_ID`,
  `MICROSOFT_CLIENT_SECRET`, non-empty `MICROSOFT_ALLOWED_TENANT_IDS`), Google
  (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), Apple (`APPLE_CLIENT_ID`,
  `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY` or
  `APPLE_PRIVATE_KEY_PATH`). `AUTH_CALLBACK_BASE_URL` builds callback URLs;
  `AUTH_SUCCESS_REDIRECT` and `AUTH_FAILURE_REDIRECT` are client paths.
- **Microsoft** uses the multi-tenant `organizations` authority. Validate the
  ID token `tid` against `MICROSOFT_ALLOWED_TENANT_IDS`; never trust `email`
  alone. Require an exact `@unah.hn` (`student`) or `@unah.edu.hn` (`observer`)
  domain.
- **Google and Apple** are for applicants (`external`). Reject the two UNAH
  domains (and Google `hd`), and require a verified email. Apple may return a
  private relay address and only sends name/email on first authorization.
- **Linking:** look up `AccountIdentity` by provider + subject; otherwise find a
  live account by lowercase email and link it only after the provider rules
  pass. Never change an existing account's roles at login. Never match or revive
  a soft-deleted account. Create `Metadata`, `Account`, `AccountRole`,
  `AccountIdentity` and the history row in one transaction.
- **Status:** reject `locked`, `banned` and `inactive` with distinct codes;
  update `lastLogin` on success.
- **Routes:** `GET /api/auth/providers`; `GET /api/auth/<provider>`;
  `GET /api/auth/microsoft/callback`; `GET /api/auth/google/callback`;
  `POST /api/auth/apple/callback` (Apple uses `form_post`). Callbacks redirect
  with stable error codes and never return JSON. Apple's callback is exempt
  from CSRF but validates the signed `state` cookie; only that exact route is
  exempt.
- **Logging:** log provider, outcome and error code only. Never log tokens,
  authorization codes, secrets, cookies, auth headers or email bodies.
- **Development origin-secret bypass:** only when `NODE_ENV === "development"`,
  and only for the exact `METHOD + path` OAuth start/callback pairs in
  `server/src/middleware/origin-secret.ts`, may `/api/*` skip
  `x-origin-secret`. Production and every other environment must route OAuth
  through the proxy. No env flag enables this. The server logs a warning once
  at startup when the bypass is active.
- **Shared domain rules stay pure.** `shared/src/domain/federated-email.ts` is
  Prisma-free and owns email/domain classification; keep it table-tested.

## Data layer conventions

### Metadata (1:1, required)

- Every aggregate root (`Account`, `Campus`, `Course`, `CourseMaterial`,
  `TutorApplication`, `TimeSlot`, `SessionRequest`, `ProgrammedSession`,
  `SessionReport`) has a **required** `metadataId @unique` pointing at
  `Metadata`. `Metadata` holds `createdBy`, `updatedBy`, `createdAt`,
  `updatedAt` only.
- Create the entity and its `Metadata` row in the same `runInTransaction`.
  Relations use `onDelete: Restrict`, so hard-deleting an entity must delete
  its `Metadata` row in that same transaction (history cascades from it).
- `MetadataUpdateHistory` is business audit data, not a log. Each row carries
  `metadataId`, `entityType` (enum `EntityType`), `entityId`, `updatedById`
  and the `changes` JSON. Write it through the helpers in `server/src/db/`.
- Adding an aggregate root means adding it to `EntityType` and to the back
  relations on `Metadata`.

### Soft delete

- Aggregate roots carry `deletedAt DateTime?` and `deletedBy String?`. There is
  **no** `deleted` boolean. `deletedAt IS NULL` means the row is live;
  `deletedBy` is null whenever `deletedAt` is null.
- **Services** are responsible for filtering. Every read in a service must
  exclude soft-deleted rows unless it is an explicit admin "include deleted"
  path. Do not rely on Prisma middleware (removed in Prisma 7) and do not
  filter in controllers.
- Use the soft-delete helper in `server/src/db/` so all of this happens in one
  transaction: set `deletedAt`/`deletedBy`, write a history row, and replace
  unique natural keys (below).
- Join and child tables (`AccountRole`, `SessionRegistration`,
  `SessionFeedback`) are **hard-deleted**, usually by cascade.

### Unique values and deletion

Unique natural keys (`Account.email`, `Account.identifier`, `Campus.code`,
`Course.code`) are replaced on soft delete by a one-way keyed hash of the
original value, so the original can be reused by a new row. Rules:

- Compute `del:` + hex HMAC-SHA256 of `<column>:<id>:<original value>` with the
  server secret `SOFT_DELETE_HASH_KEY` (document it in `.env.example`).
- Apply it to every unique natural key of the row, in the same transaction.
- The hash is one-way. Restoring a soft-deleted row requires new values from
  the operator; do not store originals in `changes` or anywhere else.
- Never rely on `deletedAt` inside a unique index; MariaDB treats NULLs as
  distinct, so the hash is what keeps uniqueness correct.

### Schema style

- Models are singular PascalCase (`Course`, not `Courses`). Foreign keys are
  `<relation>Id`. Name relations explicitly when a model points at the same
  target twice.
- Long text uses `@db.Text`. Do not add redundant `@@index` on `@unique`
  columns.
- Keep `Session` as the auth session model name with `@@map("sessions")`.
- No `prisma db push`. Schema changes ship as forward migrations only.

## Conventions

- **REST resources.** `GET/POST/PATCH/DELETE /api/<resource>` and action
  subresources such as `POST /api/accounts/:id/status`. `DELETE` on a
  soft-deletable resource is a soft delete.
- **DTOs only.** Never return Prisma rows or password hashes. Map rows in
  `server/src/http/dto/`. DTOs never expose `deletedBy` to non-admins.
- **Every protected route declares a permission** with `requireAuthenticated`
  and `requirePermission`. Default deny; the route audit test enforces it.
- **Errors are thrown as `AppError` subclasses.** Do not add per-controller
  status mapping. The central handler returns
  `{ error: { code, message, details?, traceId } }`.
- **Log only through pino** (`req.log` or `server/src/logger.ts`). Never write
  application logs to the database.
- **Database changes only through Prisma Migrate.** Never edit an applied
  migration; add a forward one.
- **Shared stays Prisma-free.** No `@prisma/*` imports in `shared/`, no Express,
  React or Node-only APIs.
- **Validate with the shared Zod schemas.** Do not duplicate request shapes.
- **Transactions and audit.** Mutations that touch metadata/entity/history use
  `runInTransaction` plus the helpers in `server/src/db/`.
- **The client mirrors the server policy.** Use `can`, `<Can>` and
  `<RequirePermission>`; never invent a permission string.

## Commits and branches

- Work on a branch. Do not commit to `main`.
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `ci:`,
  `build:`, `test:`. Imperative mood, header at most 72 characters.
- Use `!` and a `BREAKING CHANGE:` footer for schema or API breaks.
- One logical change per commit. Tests, docs and `.env.example` updates ship in
  the same commit as the code.
- `commitlint.config.mjs` enforces the format in CI.

## Add a module

Use an existing slice (`Campus` or `Course`) as the reference; if the `Item`
example is still present, it works too. For a `Widget`:

1. Shared: `shared/src/schemas/widgets.ts`, `shared/src/api/widgets.ts`, export
   from the index files, add permissions to `shared/src/rbac/permissions.ts`
   and grants to `matrix.ts`, update `rbac.test.ts`.
2. Database: add the model with required `metadataId`, `deletedAt`, `deletedBy`
   (if it is an aggregate root), add it to `EntityType` and to the back
   relations on `Metadata`, then create a forward migration:
   `MIGRATE_DATABASE_URL="mysql://…/app" npx prisma migrate dev --create-only --name add_widget`.
   Inspect the SQL, then `npm --prefix server run db:deploy`.
3. Server: service (filters soft-deleted rows, hashes unique keys on delete),
   DTO mapper, controller and router with permissions; mount it in
   `server/src/routes/index.ts` and construct the service in
   `server/src/app.ts`; add the router to
   `server/test/routes/route-audit.test.ts`.
4. Client: feature folder, API module, route under `client/src/routes/admin/`,
   nav entry gated by `<Can>`, locale keys in both `en` and `es`.
5. Tests at each layer, then `npm run lint && npm run typecheck && npm run test
   && npm run build`.

Remove the example with `node scripts/remove-example.mjs --dry-run` first.

## Add a permission

1. Add the literal to `shared/src/rbac/permissions.ts`.
2. Grant it in `shared/src/rbac/matrix.ts` (admin receives every permission
   automatically through `PERMISSIONS`).
3. Update `shared/src/rbac/rbac.test.ts`.
4. Add `requirePermission("resource:action")` to the route.
5. Gate the client UI with `<Can>` or `<RequirePermission>`.
6. Rebuild shared and run the full gate.

No migration is required for a permission.

## Add a role

Roles are a Prisma enum (`Role`) stored per account in `AccountRole`
(`@@unique([accountId, role])`; an account can hold several roles). Current
roles: `tech_admin`, `general_admin`, `campus_admin`, `tutor`, `student`,
`external`, `observer`. A new role needs a migration:

1. Add the value to `Role` in `server/prisma/schema.prisma`.
2. Add it to `ROLES` and `ROLE_RANK` in `shared/src/rbac/roles.ts`.
3. Add it to `ROLE_PERMISSIONS` in `shared/src/rbac/matrix.ts`.
4. Add locale labels for the roles page.
5. Create and apply a forward migration:
   `MIGRATE_DATABASE_URL="mysql://…/app" npx prisma migrate dev --create-only --name add_role_example`,
   then `MIGRATE_DATABASE_URL="mysql://…/app" npx prisma migrate deploy`.
6. Run the full gate.

## Testing expectations

- Tests ship with the code. Do not merge a feature without tests.
- `shared`: table-driven RBAC and schema tests.
- `server`: unit tests for config/logging/errors/validation plus integration
  tests for routes, the permission matrix, audit rows, last-admin guard and the
  docs API. Also cover: soft-deleted rows hidden from service reads, unique
  keys hashed and reusable after delete, metadata created and removed with its
  entity, and feedback carrying no author. Integration tests use MariaDB and
  truncate tables.
- `client`: Testing Library tests for RBAC, guards, pages, docs markdown and
  i18n key parity.
- Run `npm run test` before every commit. With a database, never leave the
  integration suites skipped by accident.

## Never do

- `prisma db push` (any environment).
- Commit `.env`, `.env.*` (except `*.example`), tokens, passwords or generated
  secrets.
- Edit a migration that has already been applied.
- Add wildcard permissions or bypass the default-deny registry.
- Import Prisma into `shared/`.
- Log secrets, cookies, authorization headers or database URLs.
- Bypass `requireAuthenticated`/`requirePermission` on a protected route.
- Reintroduce a `deleted` boolean, or return soft-deleted rows from a service
  by accident.
- Store original unique values of a soft-deleted row, or leave them unhashed.
- Add an author, student or account link to `SessionFeedback`.
- Add a dependency without checking `knip` (`npm --prefix <pkg> run knip`).
- Commit generated `dist/`, `coverage/` or `site/` output.
- Store provider access, refresh or ID tokens, or trust an unverified email.
- Match a Microsoft login by email without the `tid` allowlist check.
- Allow `*unah*` substring or suffix-without-dot domain matches.
- Revive a soft-deleted account through federated login or change an existing
  account's roles at login.
- Enable the origin-secret bypass outside development.
