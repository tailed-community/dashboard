# NPX Init Process (v1)

## Objective
Provide a deterministic `npx` bootstrap flow so any contributor can clone, initialize, and start feature work with no hidden setup knowledge.

## Scope
This process covers local contributor setup for the dashboard + functions stack, emulator startup, environment generation, seed loading, and health verification.

## Non-Goals (v1)
Production deployment, release automation, and org-wide policy enforcement are tracked as future governance phases.

## Prerequisites
1. Node.js 22.x and npm 10+.
2. Git installed and GitHub access token available (optional for public clone, required for authenticated operations).
3. Docker Desktop (or Docker Engine + Docker Compose plugin) installed and running.
4. Required local ports available (Auth 9100, Functions 5003, Firestore 8081, Hosting 5004, Storage 9200). 

## Environment Contract
1. Root `.env` is for frontend (`VITE_*`).
2. `functions/.env` is for backend (`FB_*`, service keys, mail/dev integrations).
3. The init command must never print secret values.
4. Missing required variables must fail fast with a clear error message.
5. Existing `.env` keys must be preserved unless explicitly overwritten.

## Init Workflow
1. Discover `tailed-community` public repositories from `https://github.com/tailed-community`.
2. Ask user to select target repository.
3. Clone selected repository locally from the community org (no fork required for standard local setup).
4. Ask user to select issue, create issue, or continue in free-dev mode.
5. Validate local prerequisites (Node, npm, Firebase CLI, auth state).
6. Generate root `.env` from template + defaults + user overrides.
7. Generate `functions/.env` from template + defaults + user overrides.
8. Start Firebase emulators with project-safe defaults.
9. Fetch and validate seed dataset manifest.
10. Seed Firestore/Auth/Storage emulator data.
11. Start Mailhog STMP Server emulator.
12. Update .env files
13. Run post-seed consistency checks.
14. Run health checks and print next-step commands.

## Health Checks (must pass)
1. Frontend dev server reachable.
2. Functions emulator responds.
3. Firestore emulator reachable.
4. Auth emulator reachable.
5. Storage emulator reachable.
6. Required env keys resolved in both runtimes.

## Idempotency Rules
1. Re-running init must be safe.
2. Seed operations must be upsert-based or namespace-isolated.
3. Generated files must include headers showing tool/version/timestamp.
4. Init state must be persisted (example: `.tailed/init-state.json`).

## Contributor Notes
1. Prefer emulator-first development over Docker-first.
2. Treat init as source of truth for local onboarding.
3. Any new required env key must be added to templates and validators in the same PR.
4. Any setup change must update this document before merge.

## Future Governance (planned)
1. Branch naming standard.
2. Commit structure and lint gates.
3. PR checklist policy.
4. Release and versioning model.
5. Ownership and CODEOWNERS policy.

## Dashboard Improvements Required for Env Reliability

1. Add missing templates:
`.env.example` and `functions/.env.example` with comments and required/optional markers.

2. Add runtime env validation:
- Frontend validator module for `import.meta.env`.
- Functions validator module for `process.env`.
- Fail startup with actionable errors.

3. Fix env-name drift:
- Code uses `WEB_APP_URL` in functions routes.
- CI writes `FRONTEND_URL`.
- Standardize to one key and support a temporary fallback alias.

4. Fix dev script portability:
- Root `serve` script currently chains `cross-env` in a way that may not set `NODE_ENV` as intended.
- Use a single command form that sets env and starts emulators in one step.

5. Align required keys with actual code usage:
- Frontend expects additional Firebase keys beyond current local set.
- Functions code expects keys not always present in `functions/.env`.
- Validator + templates must reflect true runtime requirements.

6. Add `env:check` and `env:doctor` scripts:
- `env:check`: strict required-key validation.
- `env:doctor`: reports missing/unused/mismatched keys and naming aliases.

7. Enforce no-secret leaks:
- Redact values in logs.
- Block accidental `.env` commit via gitignore and pre-commit checks.