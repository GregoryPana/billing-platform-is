PACKAGE_ID: 1
PACKAGE_STATUS: completed

## Scope
Runtime origin/proxy verification for the CORS "Blocker" finding on `backend/app/main.py`. Read-first task; code change only if a genuine cross-origin mismatch was found. No files in the pre-existing dirty worktree were touched. This session's delta: `docs/RG01_ALIGNMENT_TRACKER.md` (Package 1 entries) and this handover.

## Rebaseline
- `backend/app/main.py:10-16` still hardcodes `CORSMiddleware(allow_origins=["http://localhost:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])` — unchanged from the description in the task.
- `backend/app/config.py` (`Settings`, lines 1-38) has no `cors_allowed_origins` or any CORS-related field. Confirms nothing was already added.

## Proxy/origin evidence
- `frontend/.env.production.example`: `VITE_API_URL=https://n8n-lan.cwsey.com/billing-api`, and Entra `VITE_ENTRA_REDIRECT_URI` / `VITE_ENTRA_POST_LOGOUT_REDIRECT_URI` both `https://n8n-lan.cwsey.com/billing/`. Frontend and API share scheme (`https`), host (`n8n-lan.cwsey.com`), and implicit port (443) — differing only in path.
- `docs/github-deployment-guide.md:183-207` documents this repo's actual Nginx setup:
  - `location /billing-api/ { proxy_pass http://localhost:8010/api/; }`
  - `location /billing/ { alias /opt/<app>/frontend/dist/; try_files $uri $uri/ /<app>/index.html; }`
  - Both locations live inside the same `server` block (added "before a catch-all `location / {}`" on the existing site), i.e. the same `server_name`/scheme/port.
- No `nginx*`/`proxy*`-named config files exist anywhere in the repo (`find . -iname "*nginx*" -o -iname "*proxy*"` returned nothing outside this doc's prose); the deployment guide is the only routing evidence available in this snapshot, and it corroborates the same-origin conclusion rather than contradicting it.
- No plan for a cross-origin deployment was found in `docs/DEPLOYMENT_SAFETY.md`, `docs/github-deployment-guide.md`, or the RG-01 tracker/backlog (packages 2-11 don't mention CORS or a separate API domain).

## Stop-gate decision
Verification confirms production is same-origin: frontend served at `/billing/` and API proxied at `/billing-api/` under one Nginx `server` block, matching the deployment evidence already given in the task. No evidence of a planned cross-origin deployment. Per the stop-gate instruction, **no code change was made**. `backend/app/main.py`'s hardcoded `allow_origins` remains a cosmetic staleness issue, not an active CORS misconfiguration in production — browser CORS enforcement doesn't apply to same-origin requests, so this is inert as-is.

## Checks run
None required — no application code changed. Verification was direct reads of `backend/app/main.py`, `backend/app/config.py`, `frontend/.env.production.example`, `docs/github-deployment-guide.md`, `docs/DEPLOYMENT_SAFETY.md`, plus a repo-wide `find` for nginx/proxy config files (none found beyond the doc).

## Defects found/rectified
None. The earlier review's "Blocker" classification is not upheld by available evidence — reclassify as informational/non-blocking pending live Nginx confirmation (this snapshot cannot read the actual VM's `nginx -T` output, only the deployment guide's documented intent).

## Remaining blocker / next safe action
None for Package 1 — closed as verification-complete, no code change needed. Next in register: Package 2 (sign-in boundary copy, password-toggle touch/contrast polish), contingent on the usage gate being re-checked before that session starts.

## Commit/push/deploy/migration/auth
None performed. No commit was made (no code changed; only tracker/handover docs updated, consistent with prior session's precedent of tracking these as this-session's delta rather than requiring a commit).
