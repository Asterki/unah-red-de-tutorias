# Contributing

## Branch and commits

- Work on a branch, never directly on `main`.
- Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`,
  `ci:`, `build:`, `test:`.
- The header is at most 72 characters and uses the imperative mood:
  `feat: add in-app documentation page`.
- Use `!` and a `BREAKING CHANGE:` footer for schema or API breaks.
- One logical change per commit. Tests, documentation and `.env.example`
  changes belong in the same commit as the code they describe.

`commitlint.config.mjs` enforces the format in CI.

## Before you push

Run the full gate from the repository root:

```bash
npm run doctor
npm run lint && npm run typecheck && npm run test && npm run build
```

When a change affects the docs or configuration:

```bash
pip install -r docs/requirements.txt && mkdocs build --strict
```

When a change affects the database or image:

```bash
npm --prefix server run db:validate
docker build -t unah-red-tutores-api:test .
for f in dev prod ghcr; do docker compose -f compose.$f.yaml config > /dev/null; done
```

Integration tests need MariaDB (see [testing](testing.md)). A missing database
skips them locally; CI runs them against a service container, so do not merge
with only the skipped result.

## Conventions

- REST resources, explicit DTOs, `page`/`pageSize` pagination.
- Every protected route declares a permission through the default-deny
  middleware.
- Throw `AppError` subclasses; do not write per-controller `try/catch` status
  mapping. The central handler shapes the response.
- Log through pino (`req.log` or the shared logger). Never write application
  logs to the database and never log secrets, cookies or tokens.
- Shared code must stay Prisma-free and framework-free.
- Database changes go through Prisma Migrate. Never edit an applied migration
  and never use `prisma db push`.
- Use the shared Zod schemas for request validation; do not duplicate request
  shapes in the client.

## Adding a module

The `Item` slice is the reference implementation. See
[example module](example-module.md) for the file map and the copy/remove
procedure. In short:

1. Add shared schemas, DTOs and API types.
2. Add permissions and role grants.
3. Add the Prisma model and a forward migration.
4. Add service, DTO mapper, controller and routes with permissions.
5. Add the client feature, route and navigation entry.
6. Add tests at each layer and run the full gate.

## Documentation

English is canonical. Update the relevant page under `docs/` and the
operator-facing page under `docs/in-app/` when behaviour or operations change.
The in-app pages are served only to accounts with `docs:read`.
