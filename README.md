# Red de Tutores UNAH

Tutoring management platform for UNAH: a headless Express API, a React SPA and a
Prisma-free shared contract package, wired for MariaDB, session auth,
default-deny RBAC and federated login.

- **API:** Node 24, Express 5, Prisma 7 + `@prisma/adapter-mariadb`, pino,
  sessions in MariaDB, Prisma Migrate and a one-time seed.
- **Auth:** email + password, plus Microsoft (employees and students), Google
  and Apple (applicants) through Passport. See
  [`docs/auth/federated-login.md`](docs/auth/federated-login.md).
- **SPA:** React 19, Vite 7, Ant Design 5, TanStack Router, i18next (`en`
  default, `es` included), light/dark theme.
- **Deploy:** static SPA on Vercel proxying `/api` to a headless Docker image;
  MariaDB next to the API; amd64/arm64 images on GHCR.

## Quick start

Requirements: Node 24 (`nvm use`), npm 10+, Docker.

Create a repository from this template, clone it, then run the initializer:

```bash
npm run init -- --name "Acme Admin" --slug acme --yes
```

The initializer renames packages, compose projects, the image and branding,
generates `server/.env` and `client/.env` with random secrets, starts the
development MariaDB, bootstraps the packages, migrates, seeds the first admin
and prints its one-time password once. It refuses a second run without
`--force`; use `--dry-run` to preview and `--no-db --no-install` to only
rewrite files.

Already cloned and configured manually? Start the stack:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
docker compose -f compose.dev.yaml up -d mariadb
npm run bootstrap
npm --prefix server run db:deploy
npm --prefix server run db:seed
npm run dev
```

The API listens on `http://localhost:3000`; the SPA runs on
`http://localhost:2173`. Run `npm run doctor` to check Node/npm, the env files,
the database handshake, migration status, ports and Docker.

## Commands

Root scripts only delegate to the three packages; the root has no dependencies.

| Task | Root | `shared` | `server` | `client` |
|---|---|---|---|---|
| Install | `npm run bootstrap` | `npm install` | `npm install` | `npm install` |
| Develop | `npm run dev` | — | `npm run dev` | `npm run dev` |
| Build | `npm run build` | `npm run build` | `npm run build` | `npm run build` |
| Lint | `npm run lint` | `npm run lint` | `npm run lint` | `npm run lint` |
| Typecheck | `npm run typecheck` | `npm run typecheck` | `npm run typecheck` | `npm run typecheck` |
| Test | `npm run test` | `npm run test` | `npm run test` | `npm run test` |
| Generate Prisma client | — | — | `npm run db:generate` | — |
| Validate the schema | — | — | `npm run db:validate` | — |
| Apply migrations | — | — | `npm run db:deploy` | — |
| Seed first admin | — | — | `npm run db:seed` | — |
| Diagnostics | `npm run doctor` | — | — | — |

Full gate:

```bash
npm run lint && npm run typecheck && npm run test && npm run build
```

## Documentation

The MkDocs site in `docs/` is the canonical developer documentation:

- [Start here](docs/index.md)
- [Architecture](docs/architecture.md)
- [Configuration](docs/configuration.md)
- [Database and switching MariaDB](docs/database.md)
- [Roles and permissions](docs/rbac.md)
- [API reference](docs/api.md)
- [Deployment](docs/deployment.md)
- [Testing](docs/testing.md)
- [Using the template](docs/template-usage.md)

Operator-facing pages under `docs/in-app/` are served by the API to accounts
with `docs:read` (`admin` and `manager`). Build the site with:

```bash
pip install -r docs/requirements.txt
mkdocs build --strict
```

## Repository layout

```text
client/   Vite React SPA
server/   Express API, Prisma schema/migrations, seed CLI
shared/   Zod schemas, DTOs, API types, roles and permissions
docs/     MkDocs site and in-app operator pages
scripts/  bootstrap, init, doctor, example removal, legacy import/export
```

## Deployment

- `compose.prod.yaml` builds and runs MariaDB, the one-shot `migrate` job and
  the headless API.
- `compose.ghcr.yaml` pulls an immutable image from GHCR.
- `compose.observability.yaml` adds Loki, Grafana and Alloy for local/demo use.
- `vercel.json` builds the SPA and proxies `/api` to `API_URL` with
  `x-origin-secret`.

See [deployment](docs/deployment.md) for Vercel settings, image tags and
rollback.

## License

Released under the [MIT License](./LICENSE).

Copyright © 2026 Fernando David Rivera Ulloa.
