# Operator documentation

This area is available to accounts with the `docs:read` permission (every role).
It contains the operational runbooks for this deployment.

- **Switching the database**: DSNs, least-privilege users, migrate/seed,
  backups, rollback and troubleshooting.
- **Roles and permissions**: the static matrix, `canManage`, the last-admin
  rule and how to request a role change.
- **Federated login**: Microsoft, Google and Apple sign-in, role assignment and
  error codes.
- **Deployment**: Vercel, the headless API, GHCR, health checks and rollback.

The SPA and API versions are expected to match. If a page does not load, check
`GET /readyz` and the API logs before changing configuration.

## Daily checks

1. `GET /readyz` returns `200 {"status":"ready"}`.
2. The `api` container is healthy and the `migrate` service exited with code 0.
3. Login still works for an admin account.
4. Backups are running and a restore has been tested.

Do not edit the database schema by hand. Use the migration job.
