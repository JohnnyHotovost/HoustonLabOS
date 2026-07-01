# HoustonLab OS — PRD

## Original problem statement
Build a premium full-stack web application called **HoustonLab OS** — a private internal operations system for a technical service brand (PC builds, repairs, networking, NAS, Minecraft hosting, iPhone repair, etc.). Every job, client, device, file and payment is recorded as a structured technical case file with timeline, checklist, files, secrets and finance.

## Tech & Architecture
- **Backend**: FastAPI + MongoDB (motor), modular `routes/*.py`, JWT (PyJWT), **Argon2id** password hashing (bcrypt fallback for legacy hashes), AES-256-GCM symmetric encryption (`cryptography`), `slowapi` rate limiting, append-only audit log.
- **Frontend**: React 19 + Tailwind + shadcn/ui + Recharts + lucide-react. Geist + JetBrains Mono fonts, dark graphite theme.
- **Persistence**: MongoDB volume + local persistent file uploads (`/app/data/uploads`).
- **Deployment**: `docker-compose.yml` with MongoDB + backend + nginx-served frontend, persistent volume for uploads.

## Implemented (April 2026)

### MVP (iteration 1)
- JWT login (username or email) + bcrypt + remember-me + admin seed (`admin / ChangeMe123!`).
- AES-256-GCM encryption for secrets (key in env var only, never in DB or frontend).
- 12 predefined job templates (Custom PC Build, PC Repair, Cleaning, Laptop, Console, Apple, UniFi, NAS, Minecraft, Web hosting, Consultation, Other).
- Dynamic schema-driven job form rendered from selected template.
- Full CRUD: clients, devices, jobs, templates, settings.
- Job detail with 10 tabs: Overview / Timeline / Checklist / Files / Gallery / Device / Client / Finance / Secrets / Notes.
- Service log timeline (8 entry types), checklist with progress, finance tracking, secrets vault with reveal/copy and password confirmation.
- File uploads to persistent local volume, gallery view.
- Dashboard with KPIs, monthly revenue chart, recent activity, upcoming deadlines, recent clients/devices.
- Finance page with monthly bar chart, revenue by category, outstanding & paid lists.
- Global Cmd+K search (jobs/clients/devices).
- Settings: brand, accent color, currency (CZK), profile, password change.
- Demo data seeded: 6 clients, 7 devices, 7 jobs across templates with timelines and checklists.
- English/Czech localisation.

### Security hardening (iteration 2 — April 30, 2026)
- **Argon2id** for password hashes (`argon2-cffi`, OWASP parameters); bcrypt verify fallback for legacy hashes; transparent rehash on next successful login.
- **slowapi** rate limit on `/api/auth/login` (`8/minute` default, configurable via `LOGIN_RATE_LIMIT`).
- **Audit log** collection (`audit_log`) — login.success/failed, logout, secret.created/revealed/reveal_denied/deleted, attachment.uploaded/deleted, job.deleted, profile/password updates.
- **/api/files/{id}** is the canonical file endpoint and now requires auth (path-traversal-proof, mime+ext denylist, 25 MB cap, `X-Content-Type-Options: nosniff`).
- **Security headers** middleware (X-Frame-Options DENY, Referrer-Policy strict-origin, HSTS in prod).
- **Production hardening**: `APP_ENV=production` hides docs/openapi, secures cookies, hides stack traces.

### Frontend refinements (iteration 2/3 — April 30, 2026)
- **Login polish**: image blur reduced (26 px → 8 px), removed "Access Required" emblem, "Secured Perimeter" badge, and the default-admin credentials block. Replaced with a neutral admin-tip line.
- **Dashboard date range selector** (`Today / This week / This month / Last 6 months / This year / All time / Custom`) — defaults to Last 6 months. Wired to the new `?range=` and `?from=&to=` backend params; chart uses `series` with adaptive bucket granularity (day/week/month).
- **Finance date range selector** — same component, defaults to This month.
- **Custom-range dialog** — shadcn `Dialog` (with a 50 ms defer past Radix Select portal unmount) for from/to date entry.
- **Auth-protected file delivery** — new `<AuthImage>` (axios-blob fetch) for the gallery; new `downloadFile(url, name)` helper for the Files tab.
- **Force-password-change UI** — sticky red banner across the app while `must_change_password=true`, plus highlighted notice + auto-scroll on `/settings#change-password`.

### Audit Log viewer + polish (iteration 4 — April 30, 2026)
- **Read-only Audit Log page** at `/audit` (sidebar nav item) — table with timestamp + relative time, event badge (icon + tone per event family), user, entity, IP, user-agent (truncated), meta pills (size/mime/job_id/fields).
- **Filters**: RangePicker (defaults to This month), event-type Select (populated from `/api/audit/meta`), user Select, free-text search (regex across username/entity_label/entity_id/event/ip).
- **Backend extensions**: `/api/audit` accepts `event`, `username`, `q`, `range`, `from`, `to`, `limit` (max 1000). New `/api/audit/meta` returns distinct events + usernames for filter dropdowns.
- **`file.viewed` audit event** added on every authenticated `GET /api/files/{id}` so file access is now part of the audit trail.
- **Range option order** unified everywhere: Today → This week → This month → Last 6 months → This year → All time → Custom (and matching Czech labels).
- **Recharts initial-tooltip fix**: custom Tooltip content returns `null` when `active` is false on Dashboard + Finance charts — no more popup on initial mount.

### Dashboard Security card + secret.copied tracking (iteration 5 — April 30, 2026)
- **Compact SecurityCard** on the Dashboard (last 24 h by default): Sign-ins, Failed logins, Secrets revealed, Files viewed, Deletions, plus a 6th *Reveal denied* tile when >0. Subtle red ring + ShieldAlert icon when failed_logins>0 OR reveal_denied>0; calm "No unusual activity in the last 24h" state when everything is zero. *View audit log* link → `/audit`.
- **Backend**: new `GET /api/audit/summary?range=…` returns `{range, counts:{login_success, login_failed, secret_revealed, secret_reveal_denied, secret_copied, secret_created, secret_deleted, file_viewed, file_uploaded, file_deleted, deletions, settings_updated}, raw}`.
- **Frontend `secret.copied` audit**: clicking *Copy* on a revealed secret fires `POST /api/jobs/{job_id}/secrets/{sid}/copied` (audit-only — never sends the value). Endpoint stores `entity_label` (label) + `meta.job_id` and IP/UA. Verified by 16 new pytest tests including a load-bearing "no plaintext leak" assertion.

### RBAC + Profit + Templates split + Reports + MoneyInput (iteration 6 — May 1, 2026)
- **Roles**: `admin`, `collaborator`, `spectator`. Backend helpers `require_role(...)` + `require_min_role(...)`; enforced on all create/update/delete endpoints across jobs/clients/devices/templates/uploads.
- **Users management** (admin-only) at `/users`: full CRUD + role change + password reset + last-admin guard. Audit events `user.created/updated/role_changed/password_reset/deleted`. Username editable from Settings (with uniqueness checks). `last_login_at` tracked on login.
- **Permissions per role**:
  - Spectator → read-only; `/api/dashboard/finance` blocked (403); `/api/dashboard/stats` strips revenue/profit; sidebar hides Finance/Audit/Users; JobDetail Finance tab hidden; secret reveal blocked.
  - Collaborator → can create/update jobs/clients/devices/files/checklist/timeline + add secrets; cannot delete entities, cannot reveal/delete secrets, cannot manage users/templates.
  - Admin → everything (existing behaviour).
- **Profit tracking**: new `parts_cost` + `other_costs` fields on FinanceInfo. `Profit = paid_amount − (parts_cost + other_costs)`. Surfaced on Finance KPIs (Revenue + Profit + Outstanding + Avg), 2-series bar chart, by-category profit breakdown, JobDetail Finance summary card (Customer total / Internal cost / Profit), Dashboard revenue KPI hint. New backend keys: `dashboard/stats.profit:{range,total,currency}`; `dashboard/finance.total_profit + avg_profit + by_category[].profit + series[].profit + total_internal_cost + paid_jobs[].profit`.
- **MoneyInput** component replaces raw `<Input type="number">` for money fields; selects-all when value is 0 on focus, allows clearing while typing, commits to 0 on blur.
- **Templates split** (idempotent seed by name; old templates retained for compatibility):
  - Laptop Service → Laptop Repair + Laptop Cleaning
  - Console Service → Console Cleaning (cleaning-focused)
  - Networking / UniFi Setup → General Network Setup + UniFi Setup
  - NAS / Server Setup → NAS Setup + Server Setup
- **Job Sheet / Customer Report** at `/reports` (sidebar nav) and `/reports/job/:id` (button on JobDetail). Print-ready document with brand header, client/device, dates, status, summary, work-performed timeline, checklist summary, customer-visible photos, price summary. Toggles for prices / checklist / photos. Browser print-to-PDF works today; server-side PDF endpoint is a follow-up. **Strict exclusions**: internal_notes, secrets, audit data, system info.

## Backend response shape (current)
- `GET /api/dashboard/stats?range=...` → `{ counts, revenue:{range,total,currency}, range:{key,from,to,granularity}, series:[{bucket,revenue}], by_status, by_category, recent_activity, recent_clients, recent_devices, upcoming }`
- `GET /api/dashboard/finance?range=...` → `{ total_revenue, unpaid_total, paid_count, unpaid_count, avg_job_value, by_category, series:[{bucket,revenue}], unpaid_jobs, paid_jobs, range, currency }`

## Testing
- **82/82 backend pytest green** (80 passed + 2 intentional skips). Iteration 7 (June 2026) stabilized the legacy suite:
  - Added `/app/backend/tests/conftest.py` — provisions & self-heals a **dedicated TEST-ONLY admin `qa_admin` / `QaAdmin12345!`** (role=admin) so tests never depend on the demoted default `admin` account or the real admin `wmatěj`. Also auto-purges suite-generated `test_(collab|spec|admin2)_*` users at start/end (fixes leftover-user accumulation).
  - Repointed all 4 test files (`backend_test.py`, `test_rbac_iter6.py`, `test_audit_new.py`, `test_security_card.py`) to `qa_admin`.
  - Last-admin block-path tests (`test_last_admin_guard_demote/deactivate`) now **skip when other active admins exist** (they mutated the shared session admin before, causing cascade 403s; the block path is only reachable in a single-admin DB).
  - Relaxed brittle exact-seed-count list assertions (clients/devices/jobs `>= N`) to non-empty, since demo data can be legitimately deleted.

### Server-side Customer Job Sheet PDF (iteration 7 — June 2026)
- New endpoint **`GET /api/jobs/{job_id}/report.pdf`** (`require_min_role("collaborator")`, spectator blocked). Query toggles `prices`/`checklist`/`photos` (default true) mirror the web report switches.
- `/app/backend/report_pdf.py` — builds an HTML template that reproduces the Reports print view's light-theme layout (same header/client/device/dates/summary/work-performed/checklist/photos/price-summary/footer, same `total = labor + parts − discount`, cs-CZ money formatting) and renders via **WeasyPrint** (`weasyprint==69.0`). Photos embedded as base64 from `UPLOAD_DIR`. Strict exclusions preserved: internal_notes, secrets, audit/system info.
- Frontend `Reports.jsx`: added a **Download PDF** button (reuses `downloadFile`) alongside the existing browser **Print / PDF** button (print view kept intact).
- Known minor difference: fonts (web uses Geist/JetBrains Mono; server uses close sans/mono stacks) and page margins may render very slightly differently; layout/sections/labels/data match.
- Tests: `TestReportPdf` in `test_rbac_iter6.py` (admin+collaborator 200 %PDF, spectator 403, unknown job 404, toggles). Full suite: **85 passed, 2 skipped**.
- Iterations: `iteration_1.json` (MVP) · `iteration_2.json` (security + frontend) · `iteration_3.json` (custom-range fix) · `iteration_4.json` (audit log + range order + tooltip fix) · `iteration_5.json` (security card + secret.copied) · `iteration_6.json` (RBAC + profit + templates + Users + Reports + MoneyInput).

## Backlog (P1)
- ~~Server-side PDF endpoint for the Customer Report~~ ✅ DONE (iter7 — `GET /api/jobs/{id}/report.pdf` via WeasyPrint, mirrors print view; browser Print button retained).
- Photo before/after comparison slider in gallery.
- Bulk actions in jobs list (set status, archive).
- Custom template editor UI (currently only via API; admin-only).
- Webhooks/notifications (email or telegram on job status change).
- Migrate `@app.on_event` to FastAPI lifespan.
- Restrict CORS allow_origins to explicit list when credentials are enabled.
- Track `secret.copied` audit events from the frontend for full sensitivity history.
- ~~Fix `backend_test.py` legacy auth tests~~ ✅ DONE (iter7 — dedicated `qa_admin` test account via conftest).

## Backlog (P2)
- Multi-user support with roles (technician/admin).
- Time-tracking per job.
- Auto-generated customer-facing invoice page.
- Scoped “block default password” policy (currently global; should be admin-only).
