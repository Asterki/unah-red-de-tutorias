# BUILD PROMPT — Phase P5: Docker, compose, observability, Vercel, GHCR

You are an autonomous senior engineer executing one phase of an approved refactor of a Node/Express/Prisma/MariaDB + React/Vite/Ant Design template. Work from the repository root.

## Read first
1. `FINAL_PLAN.md` at the repo root: §0 (what changed), §1 (execution rules), §4 (decisions), §5 (architecture and env reference) and the P5 table in §6. This prompt expands that table. If they conflict, FINAL_PLAN.md wins; record the conflict in your final report.
2. `AGENTS.md` if it exists (it appears in Phase 6).
3. Before editing any file, read the files you are about to change. Do not rely on memory of earlier phases.

## Non-negotiable rules
- Branch: `refactor/template-v1`. Never commit to `main`.
- One task = one commit. Conventional Commits, header at most 72 characters, imperative mood. Use the exact commit message given for each task.
- Tests, docs and `.env.example` updates for a change go in the same commit as the change.
- Do NOT push. Do not open a PR. Commits stay local until Phase 7.
- Never commit `.env`, `.env.*` (except `*.example`), tokens, passwords or generated secrets. Never print secrets in logs or in your report.
- Never use `prisma db push`. Never edit a migration after it has been committed.
- Do not do work that belongs to another phase. If something outside this phase blocks you, stop and report.
- Items marked `UNVERIFIED` in FINAL_PLAN.md must be proven by running something. If you cannot run it (no Docker, no network), say so explicitly and mark the result `UNVERIFIED` in the report. Do not claim success.
- If a verify command fails, fix the cause and amend the task's commit (`git commit --amend`) before moving on. Never skip a task, never disable a test or lint rule to make a check pass.
- If a planning assumption turns out false, write a short ADR in `docs/decisions/NNNN-title.md` (at most 10 lines: context, finding, decision) in the same commit as the fix.
- Prefer the smallest change that satisfies the acceptance criteria. Do not refactor unrelated code.

## Preflight (run first; stop and report if any fails)
- Branch `refactor/template-v1`; all P4 commits present; full build green.
- Docker with buildx is available. If Docker is not available, you may write files but must mark every Docker/compose verification `UNVERIFIED` and stop before P5-08.
- Read `docs/decisions/0001-package-layout.md` for the shared-code decision and the Prisma adapter pool finding.

## Final report (your last message)
Reply with exactly these sections:
1. Commits made: `hash subject` per task.
2. Gate results: each gate command and pass or fail.
3. Deviations from the plan, ADRs written, and anything left `UNVERIFIED`.
4. Open problems that block the next phase (or "none").

## Goal
Ship a headless API image to GHCR, pull-only and source-build compose files, an optional observability overlay, and Vercel configuration for the SPA with an API proxy. Every commit stays green.

## Task P5-01 — Multi-stage production image
Commit: `build: add multi-stage production image`
Create `Dockerfile` at the repo root (build context = repo root) and `.dockerignore` (exclude `**/node_modules`, `.git`, `**/.env*` except examples, `client`, `docs` except `docs/in-app`, `coverage`, `dist`, tests where safe).
Stages:
1. `base`: `node:24-alpine`, `RUN apk add --no-cache tini`, build tools only in the builder stages if native modules need them.
2. `shared-build`: copy `shared/`, `npm ci`, `npm run build`.
3. `server-build`: copy `server/` and the built shared; `npm ci`; `npx prisma generate`; `npm run build` (tsup bundle with shared inlined, plus `dist/cli/seed.js`).
4. `prod-deps`: `npm ci --omit=dev` in `server/` (include `prisma` CLI as a runtime dependency if the `migrate` service needs it; otherwise copy it from the builder; choose the smaller working option and record it).
5. `runtime`: copy `dist`, `prisma/` (schema and migrations), `prisma.config.ts`, prod `node_modules`, the generated Prisma client and `docs/in-app`; `ENV NODE_ENV=production`; `USER node`; `ENTRYPOINT ["/sbin/tini","--"]`; `CMD ["node","dist/main.js"]` (exec form); `HEALTHCHECK CMD wget -qO- http://127.0.0.1:${PORT:-3000}/healthz || exit 1`; no client files; `EXPOSE` the default port.
Do not bake secrets or `.env` files. The migrate job reuses this image with a different command (`CMD` override).
Verify: `docker build -t unah-red-tutores-api:test .`; `docker run --rm unah-red-tutores-api:test id` shows a non-root uid; `docker run --rm unah-red-tutores-api:test ls` shows no `client`; running without env prints a clean config error and exits non-zero; `docker image inspect` size is reasonable (report it).

## Task P5-02 — Development compose
Commit: `build: add development compose`
`compose.dev.yaml`: service `mariadb` (`mariadb:11.4`, `env_file: server/.env` or documented `.env.dev`, named volume, `127.0.0.1:3306:3306`, healthcheck using `healthcheck.sh --connect --innodb_initialized`, `restart: unless-stopped`); `adminer` under `profiles: ["tools"]` on `127.0.0.1:8080`. No API service (the API runs on the host with hot reload). Document the commands in README.
Verify: `docker compose -f compose.dev.yaml config`; `up -d mariadb` reaches `healthy`.

## Task P5-03 — Production compose with migrate job
Commit: `build: add production compose with migrate job`
`compose.prod.yaml` with services:
- `mariadb`: pinned `11.4`, healthcheck, volume, no published port by default.
- `migrate`: `build: .` (target runtime), `command` runs `prisma migrate deploy` then `node dist/cli/seed.js`, `restart: "no"`, `depends_on` mariadb `service_healthy`, uses `MIGRATE_DATABASE_URL` for deploy and `DATABASE_URL` for seed.
- `api`: `build: .`, `depends_on: {migrate: {condition: service_completed_successfully}}`, `env_file`, `ports: ["127.0.0.1:${PORT}:${PORT}"]`, `restart: unless-stopped`, `read_only: true`, `tmpfs: [/tmp]`, `cap_drop: [ALL]`, `security_opt: ["no-new-privileges:true"]`, healthcheck on `/readyz`, `init: true`.
Verify: `docker compose -f compose.prod.yaml config`; with a throwaway `.env`, `up --build` makes `migrate` exit 0 and `api` healthy; `curl -fsS localhost:$PORT/readyz` returns 200. Run `down -v` afterwards.

## Task P5-04 — GHCR pull-only compose
Commit: `build: add ghcr pull-only compose`
`compose.ghcr.yaml`: same as prod but `image: ghcr.io/${GHCR_OWNER}/${IMAGE_NAME}:${IMAGE_TAG:-latest}` for both `migrate` and `api` and **no `build:` key anywhere**. `.env.ghcr.example` with only the variables needed to run (DB passwords, `DATABASE_URL`, `MIGRATE_DATABASE_URL`, `SESSION_SECRET`, `CORS_ORIGINS`, `ORIGIN_SECRET`, bootstrap admin, `GHCR_OWNER`, `IMAGE_NAME`, `IMAGE_TAG`, `PORT`). README quick start: `docker login ghcr.io`, `cp .env.ghcr.example .env`, `docker compose -f compose.ghcr.yaml pull`, `up -d`.
Verify: `docker compose -f compose.ghcr.yaml config | grep -c "build:"` prints 0. To test end to end, tag the local image `ghcr.io/example/unah-red-tutores-api:test` and run with those values.

## Task P5-05 — Optional observability stack
Commit: `build: add optional observability stack`
1. `compose.observability.yaml` (overlay to be combined with dev or prod): `loki` (pinned image, local filesystem storage config), `grafana` (pinned, provisioned Loki datasource, anonymous disabled, admin password from env), `alloy` (pinned) with a config that discovers containers via the Docker socket (mounted read-only; document that this is for dev and demos and the production pattern is a host-level collector), extracts the JSON log fields (`level`, `service`, `req.id`, `trace_id`), and labels streams with `service` and `level`, pushing to Loki.
2. `deploy/observability/{loki.yaml,alloy.river,grafana-datasource.yaml}` (use the config syntax of the pinned Alloy version; check its documentation before writing).
3. `docs/observability.md`: the stdout to collector to Loki or any backend pattern; why the app never writes logs to the DB; `pino-loki` as an opt-in alternative and its tradeoff (a network dependency inside the app); enabling OpenTelemetry (`OTEL_ENABLED=true`, standard `OTEL_*` variables) and what `trace_id` correlation gives in Grafana; sample LogQL queries (errors by service, a single request by `req.id`).
Verify: `docker compose -f compose.dev.yaml -f compose.observability.yaml config`; if you can run the stack, show that API logs appear in Grafana Explore, otherwise mark `UNVERIFIED`.

## Task P5-06 — Headless server mode
Commit: `feat: add headless server mode`
1. In `createApp`, mount static serving and the SPA fallback only when `config.SERVE_CLIENT` is true (directory `client-dist`, configurable); the fallback must never swallow `/api/*` or health routes.
2. In headless mode, `GET /` returns a JSON 404 or a small JSON service banner (`{service, version}`), not HTML.
3. Tests for both modes with a temp directory containing an `index.html`.
4. Docs note: all-in-one mode is optional and the published image is headless.

## Task P5-07 — Vercel SPA and API proxy
Commit: `feat: add vercel spa and api proxy config`
1. `vercel.json` at the repo root with `installCommand` and `buildCommand` that build `shared` then `client` (for example `cd shared && npm ci && npm run build && cd ../client && npm ci`, then `cd client && npm run build`), `outputDirectory: "client/dist"`, and a `routes` list in this order: filesystem handler; `/api/(.*)` proxy with `dest` using `API_URL` (declared in the route's `env`) and a `transforms` request-header rule setting `x-origin-secret` from `ORIGIN_SECRET` (declared in `env`); SPA fallback to `/index.html`. Follow the current Vercel documentation for `routes`, `transforms` and `env` exactly (fetch it); if the combination is not accepted, implement the documented fallback: a minimal Vercel Function or Edge Middleware at `client/api/[...path].ts` (or `middleware.ts`) that proxies to `API_URL` and injects the header, and record the decision as an ADR.
2. `client/.env.example` and docs: `VITE_API_URL=/api`; Vercel project settings (Root Directory = repo root, Node version, env scopes for Preview and Production, `API_URL`, `ORIGIN_SECRET`).
3. Document how to set `CORS_ORIGINS` to the Vercel domains and `TRUST_PROXY` to the number of proxy hops. If you can run a preview deployment, determine the correct hop count by logging `req.ip` and `x-forwarded-for` on `/healthz` in a throwaway branch; otherwise mark `UNVERIFIED` and document a procedure to determine it.
4. `docs/deployment.md`: the SPA on Vercel, headless API with `compose.ghcr.yaml`, TLS termination expectations (reverse proxy), cookie behaviour (same-site because of the proxy), and rollback.
Verify: `npx vercel build` if available; otherwise validate JSON and mark the platform behaviour `UNVERIFIED`.

## Task P5-08 — Release workflow: build, scan, publish
Commit: `ci: build, scan and publish multi-arch image to ghcr`
Create `.github/workflows/release.yml` with:
- Triggers: `push` to `main`, `workflow_dispatch` (inputs: `tag` for manual releases).
- In this task create only the `image` job. Until P5-09 adds the `release-please` job, treat `release_created` as `false` (a workflow-level env default), so only `edge` and `sha-*` tags are produced. P5-09 wires the real output in.
- Job `image` (runs on every push to `main` and on manual dispatch): `permissions: contents: read, packages: write, id-token: write` only if needed for attestations; steps: checkout, `docker/setup-qemu-action`, `docker/setup-buildx-action`, `docker/login-action` (registry `ghcr.io`, `username: ${{ github.actor }}`, `password: ${{ secrets.GITHUB_TOKEN }}`), `docker/metadata-action` with tags: `type=edge,branch=main`, `type=sha`, and, only when the release flag is `true`, `type=semver,pattern={{version}}`, `type=semver,pattern={{major}}.{{minor}}` and `latest`; OCI labels; build once to a local tag and run Trivy (`aquasecurity/trivy-action`) failing on fixed HIGH and CRITICAL vulnerabilities; then `docker/build-push-action` with `platforms: linux/amd64,linux/arm64`, `cache-from/cache-to: type=gha`, `provenance: true`, `sbom: true`, `push: true`.
- Lowercase the image name (`ghcr.io/${{ github.repository_owner }}/<slug>` through a step that lowercases).
Verify: YAML parses; run `docker buildx build --platform linux/amd64,linux/arm64 .` locally if QEMU is available (no push). Real publishing is verified after the push in Phase 7.

## Task P5-09 — Release automation
Commit: `ci: add release automation`
1. Add `release-please-config.json` (release type `node`, package at `.`, changelog sections for feat, fix, perf, refactor, docs) and `.release-please-manifest.json` (`{".": "0.1.0"}`).
2. In `release.yml`, job `release-please` using the official action with `permissions: contents: write, pull-requests: write`. The `image` job depends on it and uses its outputs. **Do not** rely on a separate workflow triggered by tag pushes: tags and releases created with `GITHUB_TOKEN` do not start other workflows.
3. Document the manual fallback: `workflow_dispatch` with an explicit tag builds and pushes that tag.
Verify: YAML parses; describe in the report what will happen on the first merge to `main`.

## Task P5-10 — Dependabot, Drone removal, repo hygiene
Commit: `chore: add dependabot and remove drone`
1. `.github/dependabot.yml`: ecosystems `npm` for `/shared`, `/server`, `/client` (weekly, grouped minor and patch), `docker` for `/`, `github-actions` for `/`.
2. Delete `.drone.yml`.
3. Add `.github/CODEOWNERS` (placeholder owner `@Asterki` with a clear TODO for `init`), `.github/pull_request_template.md` (summary, checklist: tests, docs, migration notes, breaking changes).
4. In `ci.yml`, add a `docker` job that builds the image (no push) on pull requests and runs Trivy on it.
Verify: all YAML parses; no Drone references remain (`rg -n -i drone .`).

## Phase gate
```bash
npm run lint && npm run typecheck && npm run test && npm run build
docker build -t unah-red-tutores-api:test .
for f in dev prod ghcr; do docker compose -f compose.$f.yaml config > /dev/null; done
docker compose -f compose.dev.yaml -f compose.observability.yaml config > /dev/null
```
Plus the prod compose smoke test (migrate exits 0, api healthy, `/readyz` 200) and `rg -n "build:" compose.ghcr.yaml` empty. List every item you could not run as `UNVERIFIED`.
