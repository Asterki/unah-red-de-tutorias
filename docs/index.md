# Template documentation

This repository is a reusable, single-tenant admin template:

- **Server:** Node 24, Express 5, Prisma 7 with MariaDB through
  `@prisma/adapter-mariadb`, session authentication and default-deny RBAC.
- **Client:** React 19, Vite 7, Ant Design 5, TanStack Router and i18next
  (`en` default, `es` included).
- **Shared:** Prisma-free Zod schemas, DTOs, API types, roles and permissions.

The API is deployed headlessly in Docker (or from GHCR). The SPA is deployed to
Vercel and proxies `/api/*` to the API. MariaDB runs next to the API.

## Start here

- [Get started with the template](template-usage.md): create a repository from
  this template, run `npm run init`, and deploy.
- [Architecture](architecture.md): package layout, request lifecycle and
  deployment topology.
- [Configuration](configuration.md): every environment variable and which
  package reads it.
- [Database](database.md): switching MariaDB, least-privilege users, backups
  and troubleshooting.
- [RBAC](rbac.md): roles, permissions, `canManage` and the last-admin rule.
- [Federated login](auth/federated-login.md): Microsoft, Google and Apple
  flows, linking rules, roles and error codes.
- [Provider setup](auth/provider-setup.md): obtain every OAuth value and
  configure redirect URLs for local development and production.
- [API](api.md): every route, permission, request body and response shape.
- [Deployment](deployment.md): Vercel, headless API, GHCR and rollback.
- [Observability](observability.md): stdout logs, Loki/Grafana and optional
  OpenTelemetry.
- [Testing](testing.md) and [contributing](contributing.md).

## Documentation policy

English is the canonical language for developer documentation. The UI ships
with English and Spanish locale packs; the in-app operator pages under
`docs/in-app/` are English as well.
