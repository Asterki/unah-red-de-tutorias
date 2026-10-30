# Database: MariaDB and Prisma

The template uses MariaDB through Prisma with the **`mysql`** provider and the
**`@prisma/adapter-mariadb`** driver adapter. The schema lives in
`server/prisma/schema.prisma`; migrations live in `server/prisma/migrations/`.

Single-tenant: one deployment uses one database. There is no multi-tenant
routing.

## DSN format

```text
mysql://<user>:<password>@<host>:3306/<database>
```

Examples:

```text
mysql://app_runtime:change-me@localhost:3306/app
mysql://app_migrator:change-me@mariadb:3306/app
```

- The provider is `mysql`; MariaDB is supported through
  `@prisma/adapter-mariadb`.
- URL-encode special characters in the user or password. For example, a
  password `p@ss/w:rd` becomes `p%40ss%2Fw%3Ard`:
  ```text
  mysql://app_runtime:p%40ss%2Fw%3Ard@localhost:3306/app
  ```
- The port is `3306` unless the server is configured differently.
- The database name is the URL path (`/app`).

### Pool size

Pool size is set through the adapter option `connectionLimit` in
`server/src/db/prisma.ts`, read from **`DB_POOL_LIMIT`** (default `10`). It is not
a `?connection_limit=` URL parameter. This was verified in
[ADR 0001](decisions/0001-package-layout.md): the adapter receives a
`mariadb.PoolConfig`, so the URL string is not used to configure the pool.

## Where the database changes

| Location | Change |
|---|---|
| `server/.env` (local development) | `DATABASE_URL`, `MIGRATE_DATABASE_URL`, and the `MYSQL_*` values read by `compose.dev.yaml`. |
| `.env.prod` or `.env` on the host | The same two DSNs plus `MYSQL_*` for `compose.prod.yaml`. |
| `compose.dev.yaml` and `compose.prod.yaml` | `MYSQL_*` and the named volume (`unah-red-tutores-unah-red-tutores-mariadb-data`). Changing the database name or volume without recreating the volume leaves the old data behind. |
| `compose.ghcr.yaml` | `.env` only. The image is immutable; there is no build step and no mysql settings in the file. |
| CI (`.github/workflows/ci.yml`) | The MariaDB service container values (`MARIADB_*`) and the `DATABASE_URL` / `MIGRATE_DATABASE_URL` env block. |
| Vercel | Nothing. The SPA never talks to the database. |

If you change `MYSQL_DATABASE` in a compose file, also change the database name
in both DSNs, and either create the new database or start from a fresh volume.
Existing volumes keep the old database.

## Create the database and users

Run this as a MariaDB administrator (`root` or an equivalent account):

```sql
CREATE DATABASE `app` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'app_runtime'@'%' IDENTIFIED BY '<runtime-password>';
GRANT SELECT, INSERT, UPDATE, DELETE ON `app`.* TO 'app_runtime'@'%';
CREATE USER 'app_migrator'@'%' IDENTIFIED BY '<migrator-password>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON `app`.* TO 'app_migrator'@'%';
```

Replace `'%'` with the network that actually needs access. On a single host,
use `'localhost'` or the Docker network name/host pattern instead of allowing
every host. `'%'` means "any host that can reach MariaDB"; it does not grant
access to other databases, but it widens the attack surface if the database
port is ever exposed.

`prisma migrate dev` also needs to create and drop a **shadow database**. Use a
separate local development user with the privileges to create databases, or
let Prisma use a local container where the user has those rights. Production
uses `prisma migrate deploy` only, with `app_migrator`.

Runtime user (`DATABASE_URL`): `SELECT, INSERT, UPDATE, DELETE` only.
Migration user (`MIGRATE_DATABASE_URL`): the additional DDL privileges shown
above. Do not point the running API at the migration user.

## Migrate and seed

Apply migrations first, then seed:

```bash
# From the repository root, with server/.env configured:
npm --prefix server run db:deploy
npm --prefix server run db:seed
```

Or, in a container/compose deployment, the `migrate` service runs the same
order:

```text
./node_modules/.bin/prisma migrate deploy
node dist/cli/seed.js
```

The seed is idempotent: it creates the first administrator only when the
`Account` table is empty. If `BOOTSTRAP_ADMIN_PASSWORD` is empty, the seed
generates a password, prints it **once** to stdout, and the account must change
it after the first login. The `migrate` service exits after seeding; the API
waits for `service_completed_successfully`.

To inspect migration state:

```bash
npm --prefix server run db:status
```

Never use `prisma db push` on a deployed database. It bypasses migration
history and can drop data.

## After switching databases

- **All users must sign in again.** Sessions live in the `sessions` table of
  the application database.
- Changing `SESSION_SECRET` also invalidates every session.
- If the browser keeps a stale cookie, clear cookies for the site.
- Verify the new database before cutover: row counts, a sample of accounts and
  the role values.

### Backup and restore

Take a consistent backup before a switch or migration:

```bash
mariadb-dump \
  --single-transaction --routines --triggers --hex-blob \
  --host=<host> --user=<user> --password \
  app > backup.sql
```

Restore into an empty database:

```bash
mariadb --host=<host> --user=<user> --password app < backup.sql
```

Never edit a migration that has already been applied. Add a new forward
migration instead. To roll back a failed release, restore the dump and deploy
the previous image tag (see [deployment](deployment.md#rollback)); do not try to
reverse a migration by hand.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ER_ACCESS_DENIED_ERROR` or `P1000` | Wrong user, password or host grant | Check the DSN, re-run the `GRANT` for the host that connects, URL-encode the password. |
| `Unknown database` | The database does not exist or the URL path is wrong | Create it with `CREATE DATABASE`; check the path after `:3306/`. |
| Charset or collation error | The database was created with a non-UTF8 default | Recreate it with `utf8mb4` / `utf8mb4_unicode_ci`, then migrate and seed. |
| `P1001` cannot reach the database | Host, port, firewall, Docker network or container not running | Check the host and port 3306; confirm `docker compose -f compose.dev.yaml ps` shows MariaDB healthy. |
| `P3009` failed migration | An interrupted or failed migration is recorded in `_prisma_migrations` | Inspect the table, fix the cause, mark the failed migration resolved only after understanding it, then migrate forward. Do not delete migration history blindly. |
| Too many connections | Pool size too high for the server limit | Lower `DB_POOL_LIMIT`; check `max_connections` on MariaDB. |
| Prisma client not generated | The build skipped `prisma generate` | Run `npm --prefix server run db:generate` or rebuild the image. |
| Login loops after a database switch | Stale session cookie points at a session that no longer exists | Clear cookies; sign in again. |

## Engine limits

- **MariaDB 11.4 and MySQL 8** work with provider `mysql` and
  `@prisma/adapter-mariadb`.
- **PostgreSQL and SQLite are out of scope.** Switching would require changing
  the enums, the `@db.*` column types, the JSON handling and the driver
  adapter. The migration history is also MySQL-specific.
- The template is single-tenant: one database per deployment. Sharing one
  database between deployments would mix accounts, sessions and audit rows.
