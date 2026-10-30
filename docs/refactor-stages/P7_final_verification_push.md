# BUILD PROMPT — Phase P7: Final verification and the single push

You are an autonomous senior engineer executing one phase of an approved refactor of a Node/Express/Prisma/MariaDB + React/Vite/Ant Design template. Work from the repository root.

## Read first
1. `FINAL_PLAN.md` at the repo root: §0 (what changed), §1 (execution rules), §4 (decisions), §5 (architecture and env reference) and the P7 table in §6. This prompt expands that table. If they conflict, FINAL_PLAN.md wins; record the conflict in your final report.
2. `AGENTS.md` if it exists (it appears in Phase 6).
3. Before editing any file, read the files you are about to change. Do not rely on memory of earlier phases.

## Non-negotiable rules
- Branch: `refactor/template-v1`. Never commit to `main`.
- One task = one commit. Conventional Commits, header at most 72 characters, imperative mood. Use the exact commit message given for each task.
- Tests, docs and `.env.example` updates for a change go in the same commit as the change.
- This is the ONLY phase that pushes. Push exactly once, at the very end, after every check passes.
- Never commit `.env`, `.env.*` (except `*.example`), tokens, passwords or generated secrets. Never print secrets in logs or in your report.
- Never use `prisma db push`. Never edit a migration after it has been committed.
- Do not do work that belongs to another phase. If something outside this phase blocks you, stop and report.
- Items marked `UNVERIFIED` in FINAL_PLAN.md must be proven by running something. If you cannot run it (no Docker, no network), say so explicitly and mark the result `UNVERIFIED` in the report. Do not claim success.
- If a verify command fails, fix the cause and amend the task's commit (`git commit --amend`) before moving on. Never skip a task, never disable a test or lint rule to make a check pass.
- If a planning assumption turns out false, write a short ADR in `docs/decisions/NNNN-title.md` (at most 10 lines: context, finding, decision) in the same commit as the fix.
- Prefer the smallest change that satisfies the acceptance criteria. Do not refactor unrelated code.

## Preflight (run first; stop and report if any fails)
- Branch `refactor/template-v1`; all P0-P6 commits present (P6-07 may be reported as blocked).
- The remote `origin` exists: `git remote -v`. If it does not, stop before pushing and report.
- Docker, a disposable MariaDB 11.4 and Python (MkDocs) are available for the full checklist.

## Final report (your last message)
Reply with exactly these sections:
1. Commits made: `hash subject` per task.
2. Gate results: each gate command and pass or fail.
3. Deviations from the plan, ADRs written, and anything left `UNVERIFIED`.
4. Open problems that block the next phase (or "none").

## Goal
Prove the whole refactor from a clean clone, fix what the proof exposes, archive the planning documents, and push once.

## Task P7-01 — Coverage thresholds and clean-clone proof
Commit: `test: enforce coverage thresholds`
1. Add coverage thresholds (v8) of 80 percent lines for `shared/src/rbac`, `server/src/rbac`, `server/src/http` and `server/src/middleware`; no global threshold. Wire `test:coverage` into CI and upload the coverage summary as an artifact. Remove any remaining `--passWithNoTests` flags and any `continue-on-error` left in CI.
2. Clone the branch into a temporary directory (`git clone --branch refactor/template-v1 . /tmp/verify`) and run everything from there, so untracked local files cannot hide problems:
```bash
cd /tmp/verify
npm run bootstrap
npm run lint && npm run typecheck && npm run test:coverage && npm run build
# disposable MariaDB 11.4:
export DATABASE_URL=... MIGRATE_DATABASE_URL=...
npm --prefix server exec prisma validate
npm --prefix server exec prisma migrate deploy && npm --prefix server exec prisma migrate deploy   # second run no-op
npm --prefix server exec prisma migrate status
BOOTSTRAP_ADMIN_EMAIL=admin@example.com npm --prefix server run db:seed    # twice; one admin
docker build -t unah-red-tutores-api:final .
for f in dev prod ghcr; do docker compose -f compose.$f.yaml config > /dev/null; done
docker compose -f compose.dev.yaml -f compose.observability.yaml config > /dev/null
pip install -r docs/requirements.txt && mkdocs build --strict
node scripts/init.mjs --name Acme --slug acme --dry-run
```
3. Work through the checklist below and record pass, fail or `UNVERIFIED` for each item. Fix every failure with a small follow-up commit named for the fix (for example `fix: restore csrf exemption for health endpoints`). Re-run the affected checks.

### Checklist
- [ ] Fresh clone: exactly three lockfiles, no root `node_modules`, `npm run bootstrap` succeeds.
- [ ] Lint, typecheck, tests with coverage thresholds, and build pass in every package.
- [ ] `prisma validate`; `migrate deploy` on empty MariaDB 11.4 works and is a no-op the second time; `migrate status` clean.
- [ ] Seed twice yields one admin; first login forces a password change; self password change works; the generated password is printed exactly once.
- [ ] Route-table test proves every non-public route declares a permission; viewer cannot read accounts or docs.
- [ ] Last admin cannot be deleted, demoted or disabled.
- [ ] Cookies: `HttpOnly`, `Secure` (production), `SameSite=Lax`, `__Host-` prefix; CSRF required; login flood returns 429; origin secret enforced when set.
- [ ] `rg -n "console\." server/src` empty; the redaction test passes; nothing writes logs to the database.
- [ ] `rg -n -e campus -e FormSubmission -e Universidad -e requiresTwoFactor -e account-roles` finds nothing live; `rg -n "@prisma" shared` finds nothing.
- [ ] The image runs as non-root, has no `client/dist`, passes Trivy; `compose.ghcr.yaml` has no `build:`; in the prod compose `migrate` exits 0 before `api` is healthy.
- [ ] Publish workflow YAML is valid; release-please config present; image publish is a job in the same workflow (not tag-triggered).
- [ ] Vercel configuration present; platform behaviour (proxy, header injection, client IP hop count) is either verified or listed `UNVERIFIED` with the procedure.
- [ ] Observability overlay config is valid; (manual) logs visible in Grafana, or `UNVERIFIED`.
- [ ] `mkdocs build --strict`; in-app docs: admin and manager 200, staff and viewer 403; traversal tests pass.
- [ ] `node scripts/init.mjs --dry-run` writes nothing; a real run on a scratch copy builds.
- [ ] Licences agree (MIT) or P6-07 is reported blocked.
- [ ] No `.env` or secrets in history: run `gitleaks detect --no-banner` if installed, otherwise `git log -p | rg -n -i -e "password\s*[:=]\s*['\"][^'\"]+" -e "BEGIN (RSA|OPENSSH)"` and review hits.
- [ ] `git log --format=%s main..HEAD` are all Conventional Commits; `git diff --check` clean; `git status --short` clean.

## Task P7-02 — Archive planning documents and push
Commit: `docs: archive planning documents`
1. `mkdir -p docs/archive && git mv SUMMARY.md PLAN.md FINAL_PLAN.md docs/archive/` (also move the phase build prompts if they exist in the repo). Exclude `docs/archive` from the MkDocs nav (`exclude_docs` or by omission) and confirm `mkdocs build --strict` still passes.
2. Review `git diff --stat main...HEAD` and `git log --oneline main..HEAD`. Confirm no secrets, no `.env`, no `.spike`, no generated `dist` or `coverage`.
3. Push exactly once:
```bash
git push -u origin refactor/template-v1
```
4. Do not open a PR unless asked. After the push, report the CI run URL if you can obtain it with `gh run list --branch refactor/template-v1 --limit 1` (if `gh` is not installed, say so).
5. If CI fails after the push, do **not** push again automatically. Report the failing job and the cause, and propose the fix.

## Final report additions
Include: the checklist with pass, fail or `UNVERIFIED` per line; the total commit count; the list of `UNVERIFIED` items with the exact procedure to verify each; the first-merge behaviour of the release workflow; and the three biggest remaining risks.
