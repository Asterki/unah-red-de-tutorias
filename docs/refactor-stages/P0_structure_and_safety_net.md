# BUILD PROMPT — Phase P0: Structure spike and safety net

You are an autonomous senior engineer executing one phase of an approved refactor of a Node/Express/Prisma/MariaDB + React/Vite/Ant Design template. Work from the repository root.

## Read first
1. `FINAL_PLAN.md` at the repo root: §0 (what changed), §1 (execution rules), §4 (decisions), §5 (architecture and env reference) and the P0 table in §6. This prompt expands that table. If they conflict, FINAL_PLAN.md wins; record the conflict in your final report.
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
- `git status --short` is clean except for untracked `SUMMARY.md`, `PLAN.md`, `FINAL_PLAN.md`.
- `git log --oneline -3` shows the original history (3 commits, head `d6ea18d`). If the branch already exists with P0 commits, resume at the first task whose commit is missing.
- `node -v` is available. Docker is optional; note availability for the spike.

## Final report (your last message)
Reply with exactly these sections:
1. Commits made: `hash subject` per task.
2. Gate results: each gate command and pass or fail.
3. Deviations from the plan, ADRs written, and anything left `UNVERIFIED`.
4. Open problems that block the next phase (or "none").

## Goal
Turn the repo into three independent npm packages (`client/`, `server/`, `shared/`), prove how they share code, and install lint, typecheck, test and CI tooling. No behaviour changes.

## Task P0-01 — Branch and runtime pin
Commit: `chore: pin node and npm versions`
1. `git switch -c refactor/template-v1`.
2. Create `.nvmrc` containing `24`. Create `.editorconfig` (utf-8, lf, 2 spaces, final newline, trim trailing whitespace) and `.gitattributes` (`* text=auto eol=lf`).
3. Add `"engines": {"node": ">=24 <25", "npm": ">=10"}` to the root, `server`, `client` package.json files (the `shared/package.json` is created in P0-02).
4. Verify: `node -v` prints v24.x (if not, report and stop; do not downgrade the pin), `git branch --show-current` prints `refactor/template-v1`.

## Task P0-02 — Split into independent packages
Commit: `refactor!: split into independent packages`
Goal: no npm workspaces, no hoisting, three lockfiles, root has scripts only.
1. Inventory dependencies. For every dependency in the root `package.json`, decide the owning package by searching real imports: `rg -l "from ['\"]<dep>" server/src shared client/src`. A dependency may be listed in more than one package. Anything with no import is left for P1-07 (keep it in the package where it is most likely used, do not delete yet).
2. Create `shared/package.json`: name `@unah-red-tutores/shared`, `private: true`, `type: module`, `exports` pointing to `dist/index.js` and `dist/index.d.ts`, scripts `build` (tsup, entry `src/index.ts`, format esm, dts), `typecheck`, `lint`, `test`. `zod` as both `peerDependency` and `devDependency`. Move current `shared/` TypeScript sources into `shared/src/` (keep folder names `schemas`, `api`, `types`, `constants`, `models`) and create `shared/src/index.ts` re-exporting them. Add `shared/tsconfig.json`.
3. Rewrite `server/package.json` and `client/package.json` with their own full dependency lists, scripts (`dev`, `build`, `start` or `preview`, `lint`, `typecheck`, `test`) and `"@unah-red-tutores/shared": "file:../shared"`. Update imports of `@shared/*` to `@unah-red-tutores/shared` (sub-path exports if needed) and tsconfig path aliases accordingly. Do not change logic.
4. Remove the root `workspaces` field and all root dependencies. Delete the root `package-lock.json` and any `node_modules` in the tree. Root `package.json` keeps only `name`, `private`, `engines` and delegating scripts: `bootstrap`, `dev`, `build`, `lint`, `typecheck`, `test`, each running the command in the right package with `npm --prefix`.
5. `git mv prisma server/prisma` and `git mv prisma.config.ts server/prisma.config.ts`. Fix paths inside `prisma.config.ts` (schema, migrations, env loading) so Prisma commands work from `server/`. Keep behaviour identical; the schema is rewritten in P2.
6. Write `scripts/bootstrap.mjs`: in order, `npm install` + `npm run build` in `shared`, `npm install` in `server`, `npm install` in `client`; then `npm --prefix server exec prisma generate`. It must be idempotent and fail loudly with the failing step name.
7. Generate lockfiles by running `npm run bootstrap`. Delete `server/package-lock.json` and `client/package-lock.json` first if they are stale, then regenerate.
8. Verify: `git ls-files "*package-lock.json"` lists exactly `shared/`, `server/`, `client/` locks; `test ! -d node_modules`; `npm run bootstrap` exits 0. Type errors from existing schema drift are expected; record them, do not fix them here.

## Task P0-03 — Spike: prove how packages share code
Commit: `docs: record package layout spike results`
Create a scratch directory `.spike/` (git-ignored; delete before committing). Run each experiment and record pass or fail with evidence in `docs/decisions/0001-package-layout.md` (one line per experiment plus the decision taken).
- (a) Server bundle: add `tsup` to `server`, bundle `src/main.ts` (or the current entry) to `dist/` with `noExternal: ["@unah-red-tutores/shared"]`; confirm `node dist/<entry>.js` starts to the point of config validation without resolving `../shared`.
- (b) Client: `npm --prefix client run build` resolves shared values and types.
- (c) Docker (if available): write a throwaway Dockerfile with repo-root context that builds shared, builds server, and copies only the server bundle, `node_modules` (prod) and prisma files to a runtime stage; confirm the image runs without `shared/` present.
- (d) bcrypt: `docker run --rm node:24-alpine sh -c "npm i bcrypt && node -e \"require('bcrypt').hashSync('x',4)\""` on amd64 and, if buildx/QEMU is available, arm64. Fallback candidate: `bcryptjs`.
- (e) Vercel (if the CLI is available): a minimal `vercel.json` using `routes` with `{"handle":"filesystem"}`, an `/api/(.*)` proxy to an external `dest` with a `transforms` request-header rule and `env`, and an SPA fallback; Root Directory = repo root with custom install and build commands building `shared` then `client`, output `client/dist`. If the CLI is unavailable, mark `UNVERIFIED` and leave it for P5-07.
- (f) Prisma adapter: read the installed `@prisma/adapter-mariadb` typings or docs in `node_modules` and record the correct way to set pool size, and whether a `connection_limit` URL parameter has any effect.
- (g) `TRUST_PROXY` hop count behind Vercel: mark `UNVERIFIED`, to be resolved in P5-07.
Decision rule: if (a)-(c) pass keep `file:../shared`. If any fails, implement `scripts/sync-shared.mjs` (copies `shared/src` to git-ignored `client/src/_shared` and `server/src/_shared`, wired to `predev` and `prebuild`) and update imports. Remove `.spike/` before the commit.

## Task P0-04 — Per-package tooling
Commit: `chore: add per-package lint, typecheck and test tooling`
For each of `shared`, `server`, `client` (separately, no shared config files across packages):
1. ESLint flat config (`eslint.config.js`) with `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`; client also `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh`.
2. `.prettierrc.json` (single quotes off or on matching the existing code style; check the existing code and match it), `.prettierignore`.
3. Strict `tsconfig.json` (`strict`, `noUncheckedIndexedAccess` only if it does not explode the error count; otherwise leave it off and note it).
4. Vitest: `vitest.config.ts` (environment `node` for shared and server, `jsdom` for client), `@vitest/coverage-v8`, client also `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`. Scripts `test` (`vitest run --passWithNoTests`) and `test:coverage`.
5. Scripts in each package: `lint`, `format`, `format:check`, `typecheck`, `test`, `test:coverage`, `build`. Remove broken scripts (`sample:gps`, `build:shared` at root, `build:client`).
6. Add `knip` as a devDependency in `server` and `client` with a minimal config; add a `knip` script (report only; cleanup happens in P1-07).
7. Run `format` once per package so `format:check` passes, and fix lint errors that are auto-fixable. Do not mass-rewrite unrelated code; for remaining lint errors that need logic changes, set the rule to `warn` with a `// TODO(P1+)` note only if the fix belongs to a later phase, and list them in the report.
8. Verify: `npm run lint && npm run typecheck && npm run test` from the root. `server` typecheck and build may fail because of known schema drift; record the exact errors count and do not suppress them.

## Task P0-05 — Baseline CI
Commit: `ci: add baseline workflow with secret and commit lint`
Create `.github/workflows/ci.yml`:
- `on`: `pull_request`, and `push` to `main` and `refactor/**`.
- `permissions: contents: read` at the top. `concurrency: group: ci-${{ github.ref }}`, `cancel-in-progress: true`.
- Job `packages` with a matrix `package: [shared, server, client]`, `defaults.run.working-directory: ${{ matrix.package }}`. Steps: checkout, `actions/setup-node` using `node-version-file: .nvmrc`, `cache: npm`, `cache-dependency-path: ${{ matrix.package }}/package-lock.json`; for `server` and `client` first build `shared` (`npm ci && npm run build` in `shared`); then `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Mark the `server` build step `continue-on-error: true` with a comment `# remove in P2-08` until the cutover phase.
- Job `gitleaks` using the official gitleaks action with `fetch-depth: 0`.
- Job `commitlint` (pull requests) using a pinned commitlint GitHub action configured for Conventional Commits. No root dependencies.
- Use current major versions of official actions; verify the versions exist before pinning. Third-party actions are pinned by version tag at minimum.
Verify: parse the YAML (`python3 -c "import yaml,sys;yaml.safe_load(open('.github/workflows/ci.yml'))"`).

## Task P0-06 — Environment documentation
Commit: `chore: document environment files`
1. `server/.env.example`: every server variable from FINAL_PLAN.md §5.3 with placeholders and a one-line comment each. Group them: runtime, database, security, logging, bootstrap, limits. Use obviously fake values (`change-me`, `mysql://app_runtime:change-me@localhost:3306/app`).
2. `client/.env.example`: all `VITE_*` variables.
3. Root `.gitignore`: ignore `.env`, `.env.*`, `!.env.example`, `!*.env.example`, `node_modules`, `dist`, `coverage`, `.spike`, `client-dist`.
4. Update README with a short "Environment files" section pointing to the two examples.
Verify: `git check-ignore -v server/.env` matches; `rg -n "password\s*=\s*[^c]" server/.env.example client/.env.example` finds no real secret.

## Phase gate
```bash
npm run bootstrap
npm run lint && npm run typecheck && npm run test
git ls-files "*package-lock.json"     # exactly three
git log --oneline refactor/template-v1 ^main
```
Expected: six commits (plus none other). Report any command that failed and why.
