# Using this template

## Create your repository

On GitHub, open the template repository and choose **Use this template** →
**Create a new repository**. Clone your new repository and run the initializer
from the repository root:

```bash
npm run init -- --name "Acme Admin" --slug acme --yes
```

The initializer is a plain Node script (`scripts/init.mjs`) with no
third-party dependencies. Run it once, in a clean clone, before you start
renaming things by hand.

### Flags

| Flag | Meaning |
|---|---|
| `--name <text>` | Human-readable project name (for example `Acme Admin`). |
| `--slug <slug>` | Lowercase identifier, `^[a-z][a-z0-9-]{1,40}$` (for example `acme`). Used for package names, compose project and image. |
| `--title <text>` | Browser title, PWA name and MkDocs `site_name`. Defaults to `--name`. |
| `--image <name>` | Container image name. Defaults to `<slug>-api`. |
| `--owner <owner>` | GitHub user or organisation for repository URLs, CODEOWNERS and OCI metadata. |
| `--repo <url>` | Repository URL. Defaults to the `origin` remote when available. |
| `--locale <en\|es>` | Default UI locale. |
| `--brand <#rrggbb>` | Brand colour (three- or six-digit hex). |
| `--yes` | Accept defaults instead of asking questions. |
| `--dry-run` | Print every file and replacement; write nothing. |
| `--force` | Re-run on an initialised repository (overwrites generated files). |
| `--no-db` | Do not start the development database. |
| `--no-install` | Do not run `bootstrap`, migrate or seed. |

Without flags, the script asks for the name, slug, title, image, owner,
repository URL, locale and brand colour with `readline`.

### What it changes

- package names in `shared/`, `server/` and `client/`, including the
  `@unah-red-tutores/*` imports and the lockfile names;
- compose project names and the MariaDB volume name;
- the image name in `compose.ghcr.yaml`, `.env.ghcr.example` and the release
  workflow;
- application titles and brand defaults (`shared/src/config/app.ts`,
  `client/index.html`, `client/public/manifest.json`, README, MkDocs);
- repository URLs and the CODEOWNERS placeholder;
- `repository`, `homepage`, `bugs` and `author` metadata in the root and
  package manifests (the MIT license is preserved);
- generated `server/.env` and `client/.env` with a random `SESSION_SECRET`,
  database passwords and `ORIGIN_SECRET`.

The script writes `.template-initialized` (tracked by git) with the chosen
values. A second run without `--force` is refused. `--dry-run` never writes the
marker or the env files.

### Generated environment

`server/.env` and `client/.env` are created from the examples when they do not
exist. The script never overwrites an existing env file unless you pass
`--force`. Secrets are random; they are never printed.

Unless `--no-db` is set, the script starts `compose.dev.yaml` MariaDB and waits
for its healthcheck. Unless `--no-install` is set, it runs:

```bash
npm run bootstrap
npm --prefix server run db:deploy
npm --prefix server run db:seed
```

It prints the admin email and the one-time password captured from the seed
stdout, once, with a reminder that the first login forces a password change.
If the database is not running, the migrate/seed steps are skipped with an
explanation.

## Remove the example module

The Items module is a reference implementation. Preview the removal first:

```bash
node scripts/remove-example.mjs --dry-run
```

Then remove it:

```bash
node scripts/remove-example.mjs
```

The script deletes the item files, permissions, routes, nav entry and locale
keys, and asks Prisma to create a `drop_item` migration. See
[example module](example-module.md). Keeping the module is fine; it shows the
conventions and is covered by tests.

## First deploy

1. Create the MariaDB database and users ([database](database.md)).
2. Fill `server/.env` (or the root `.env` for compose) and set a real
   `SESSION_SECRET`, `CORS_ORIGINS` and `ORIGIN_SECRET`.
3. Start the API:
   ```bash
   docker compose -f compose.prod.yaml up -d --build
   curl -fsS "http://127.0.0.1:${PORT:-3000}/readyz"
   ```
4. Deploy the SPA to Vercel with `API_URL` and `ORIGIN_SECRET` set
   ([deployment](deployment.md)).
5. Sign in with the seeded administrator, change the password, and create the
   accounts and roles you need.
6. Remove or adapt the Items example, and update this documentation for your
   project.

## Upgrading the template

See [upgrading](upgrading.md) for the legacy schema migration. For a template
created from an older commit, review the changelog and apply the relevant
commits manually; the initializer is intentionally a one-time scaffold, not an
upgrade tool.
