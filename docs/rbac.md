# Roles and permissions

RBAC is static and shared by the server and the client. There are no
user-managed roles, no wildcard permissions and no comma-separated permission
strings.

- `shared/src/rbac/roles.ts` defines `Role` and `ROLE_RANK`.
- `shared/src/rbac/permissions.ts` defines the `Permission` union.
- `shared/src/rbac/matrix.ts` defines `ROLE_PERMISSIONS`.
- `shared/src/rbac/policy.ts` defines `roleHasPermission`, `canManage` and
  `canAssignRole`.
- The client mirrors the same functions in `client/src/rbac`.

## Roles

| Role | Rank | Intent |
|---|---|---|
| `tech_admin` | 0 (strongest) | Full access, including every permission added later through `PERMISSIONS`. |
| `general_admin` | 1 | Full account, role and docs administration. |
| `campus_admin` | 2 | Read/update accounts, change status or passwords, read roles and docs. |
| `tutor` | 3 | Read documentation. |
| `student` | 4 | Read documentation. |
| `external` | 5 | Read documentation (applicant accounts created by Google/Apple). |
| `observer` | 6 (weakest) | Read documentation (institutional staff accounts created by Microsoft). |

`tech_admin` is `[...PERMISSIONS]`, so a new permission is granted to that role
without editing the matrix. Other roles must be granted explicitly.

## Permission matrix

Generated from `shared/src/rbac/matrix.ts`:

| Permission | tech_admin | general_admin | campus_admin | tutor | student | external | observer |
|---|---|---|---|---|---|---|---|
| `accounts:read` | yes | yes | yes | — | — | — | — |
| `accounts:create` | yes | yes | — | — | — | — | — |
| `accounts:update` | yes | yes | yes | — | — | — | — |
| `accounts:update-status` | yes | yes | yes | — | — | — | — |
| `accounts:change-password` | yes | yes | yes | — | — | — | — |
| `accounts:delete` | yes | yes | — | — | — | — | — |
| `accounts:restore` | yes | yes | — | — | — | — | — |
| `roles:read` | yes | yes | yes | — | — | — | — |
| `docs:read` | yes | yes | yes | yes | yes | yes | yes |

To regenerate this table from the built package:

```bash
node --input-type=module -e "import {PERMISSIONS,ROLES,ROLE_PERMISSIONS} from './shared/dist/index.js'; for (const p of PERMISSIONS) console.log(p, ROLES.filter(r => ROLE_PERMISSIONS[r].includes(p)).join(','));"
```

Run `npm --prefix shared run build` first.

## Enforcement

Every non-public route declares `requireAuthenticated` and
`requirePermission("<resource>:<action>")`. The registry is default-deny: a
route without a permission is a test failure (`server/test/routes/route-audit.test.ts`).
The server returns:

- `401` when there is no authenticated session;
- `403` when the session role lacks the permission.

The client hides navigation and buttons with `<Can>` and redirects from a
guarded route with `<RequirePermission>`. Those are UX helpers; the server is
the enforcement point.

While `mustChangePassword` is true, every route except `GET /api/auth/me`,
`GET /api/auth/csrf`, `POST /api/auth/login`, `POST /api/auth/logout` and
`POST /api/auth/change-password` returns `403` with code
`password-change-required`.

## `canManage` and role assignment

`canManage(actor, target)` is true only when the actor's rank is **strictly
lower** (stronger) than the target's rank. It never allows self-management.

```ts
canManage("tech_admin", "general_admin") // true
canManage("general_admin", "general_admin") // false
canManage("general_admin", "tech_admin") // false
```

`canAssignRole(actor, newRole)` follows the same rule: an actor can only assign
roles they outrank. General admins cannot create peers or tech admins.

The last-admin rule is enforced inside the same database transaction as the
mutation. The last active, non-deleted `tech_admin` cannot be deleted, demoted
or disabled. To recover from a manual database edit, promote an account with
SQL; the session deserialiser reads the role on the next request. There is no API
bypass.

## Add a permission

1. Add the literal to `shared/src/rbac/permissions.ts`.
2. Grant it to roles in `shared/src/rbac/matrix.ts` (admin gets it
   automatically through `PERMISSIONS`).
3. Update `shared/src/rbac/rbac.test.ts` expectations.
4. Add `requirePermission("resource:action")` to the server route.
5. Gate the client UI with `<Can permission="resource:action">` or
   `<RequirePermission>`.
6. Rebuild shared: `npm --prefix shared run build`, then run lint, typecheck and
   tests in all three packages.

No migration is required for a permission; it is code, not a database row.

## Add a role

The role is a Prisma enum, so adding one requires a schema migration:

1. Add the value to `Role` in `server/prisma/schema.prisma`.
2. Add it to `ROLES` and `ROLE_RANK` in `shared/src/rbac/roles.ts`.
3. Add an entry to `ROLE_PERMISSIONS` in `shared/src/rbac/matrix.ts`.
4. Add any locale labels used by the roles page.
5. Create and apply a forward migration (do not edit an applied migration):
   ```bash
   cd server
   MIGRATE_DATABASE_URL="mysql://app_migrator:<password>@<host>:3306/app" \
     npx prisma migrate dev --create-only --name add_role_example
   MIGRATE_DATABASE_URL="mysql://app_migrator:<password>@<host>:3306/app" \
     npx prisma migrate deploy
   ```
6. Run the checks from the repository root:
   ```bash
   npm run lint && npm run typecheck && npm run test && npm run build
   ```

The server returns the static matrix at `GET /api/roles`; the client roles page
is read-only. There is no role CRUD API to update.
