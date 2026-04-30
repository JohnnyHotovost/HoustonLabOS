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

## Backend response shape (current)
- `GET /api/dashboard/stats?range=...` → `{ counts, revenue:{range,total,currency}, range:{key,from,to,granularity}, series:[{bucket,revenue}], by_status, by_category, recent_activity, recent_clients, recent_devices, upcoming }`
- `GET /api/dashboard/finance?range=...` → `{ total_revenue, unpaid_total, paid_count, unpaid_count, avg_job_value, by_category, series:[{bucket,revenue}], unpaid_jobs, paid_jobs, range, currency }`

## Testing
- `/app/backend/tests/backend_test.py` + `/app/backend/tests/test_audit_new.py` — 46 pytest tests, 100% pass.
- Iterations: `/app/test_reports/iteration_1.json` (MVP), `iteration_2.json` (security + frontend), `iteration_3.json` (custom-range fix verified), `iteration_4.json` (audit log + range order + tooltip fix).

## Backlog (P1)
- Photo before/after comparison slider in gallery.
- Bulk actions in jobs list (set status, archive).
- Export client report PDF.
- Custom template editor (currently fields/checklist editable only via API).
- Webhooks/notifications (email or telegram on job status change).
- Migrate `@app.on_event` to FastAPI lifespan.
- Restrict CORS allow_origins to explicit list when credentials are enabled.
- Track `secret.copied` audit events from the frontend for full sensitivity history.

## Backlog (P2)
- Multi-user support with roles (technician/admin).
- Time-tracking per job.
- Auto-generated customer-facing invoice page.
- Scoped “block default password” policy (currently global; should be admin-only).
