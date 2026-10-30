# 0001 Package layout and shared-code mechanism

Context: decide whether `@unah-red-tutores/shared` can be consumed via `file:../shared` plus a tsup server bundle and a Vercel root build.
(a) PASS: `npm --prefix server run bundle` produced `dist/index.js` (88 KB) with shared inlined; `node dist/index.js` had no `../shared` resolution and exited 1 only on missing `DATABASE_URL` config.
(b) PASS: `npm --prefix client run build` transformed 1808 modules and resolved shared values/types (`../shared/node_modules/zod` was bundled).
(c) PASS for layout: a root-context multi-stage image built and ran with `/app/shared` absent; boot stopped at a pre-existing Prisma CJS/ESM named-export interop error (`MetadataSource`), not at a shared lookup.
(d) PASS amd64: `node:24-alpine` + `npm i bcrypt` + `hashSync` succeeded. UNVERIFIED arm64: no QEMU binfmt in this environment.
(e) PASS: `vercel build` accepted `routes` with `handle: filesystem`, an `/api/(.*)` proxy, and an SPA fallback; `transforms[].target` must be `{"key":"x-origin-secret"}` (a string target is rejected).
(f) PASS: `PrismaMariaDb` takes a `mariadb.PoolConfig`; set pool size with `connectionLimit` in that config. The adapter does not parse `?connection_limit=` from a URL string.
(g) UNVERIFIED: `TRUST_PROXY` hop count behind Vercel, to be measured in P5-07.

Decision: keep `file:../shared`; do not add `scripts/sync-shared.mjs`.
