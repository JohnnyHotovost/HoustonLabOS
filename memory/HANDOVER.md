# HoustonLab OS — Handover Document

**Last updated:** May 1, 2026 (iteration 6)
**Preview URL:** https://technical-hub-2.preview.emergentagent.com
**Purpose of this document:** enough context that another agent (or human) can safely continue the project without breaking existing functionality.

---

## 1. What this app does

HoustonLab OS is a **private, self-hosted internal operations system** for a one-person technical service brand (PC builds, repairs, cleaning, networking, NAS, servers, hosting, Apple repairs, consultations). Every job, client, device, file, secret and payment is captured as a structured *technical case file* with:

- Dynamic template-driven job forms (fields differ per job type)
- Timeline / service log
- Checklist with progress
- File attachments + gallery
- Encrypted secrets vault (AES-256-GCM)
- Finance with revenue **and profit** tracking
- Audit log of every sensitive action
- Print-ready customer report / job sheet

Designed for **trusted LAN / VPN only**, not public SaaS. English + Czech UI.

---

## 2. Current tech stack

- **Backend**: FastAPI (Python 3.11), Motor (async MongoDB), PyJWT, `argon2-cffi` (Argon2id passwords), `slowapi` (rate limiting), `cryptography` (AES-256-GCM)
- **Frontend**: React 19, React Router v6, Tailwind CSS, shadcn/ui, Recharts, lucide-react, sonner (toasts), Axios
- **Database**: MongoDB (Motor async driver)
- **Fonts**: Geist (UI) + JetBrains Mono (`hl-mono` class)
- **Deployment**: Docker Compose (mongo + backend + frontend + persistent uploads volume)
- **Supervisor**: manages backend (uvicorn on `0.0.0.0:8001`) + frontend (react-scripts on `:3000`) in preview

---

## 3. Frontend structure

Root: `/app/frontend/`

```
src/
├── App.js                          # Router + AuthProvider + Toaster
├── index.css                       # Tailwind base + custom CSS variables + print CSS
├── context/
│   └── AuthContext.jsx             # useAuth() hook, login/logout/refresh
├── i18n/
│   ├── I18nContext.jsx             # useT() + language switcher
│   ├── en.js                       # English strings (source of truth)
│   └── cs.js                       # Czech strings (must mirror keys)
├── lib/
│   ├── api.js                      # axios instance + downloadFile helper
│   ├── format.js                   # fmtMoney, fmtDateTime, fmtRelative + option lists
│   └── utils.js                    # cn() utility
├── hooks/
│   └── use-toast.js
├── components/
│   ├── ui/                         # shadcn/ui primitives (button, input, dialog, ...)
│   └── houston/                    # HoustonLab-specific components:
│       ├── AppShell.jsx            # Sidebar + TopBar + Cmd-K search
│       ├── AuthImage.jsx           # <img> replacement fetching via auth blob
│       ├── Badges.jsx              # StatusBadge / PriorityBadge / PaymentBadge
│       ├── DynamicFields.jsx       # Renders custom_fields per template
│       ├── EmptyState.jsx
│       ├── MoneyInput.jsx          # Money field w/ clear-to-0 UX (iter6)
│       ├── MustChangePasswordBanner.jsx  # Sticky red banner
│       ├── RangePicker.jsx         # Today/Week/Month/6m/Year/All/Custom
│       └── SecurityCard.jsx        # Dashboard security widget (24h)
└── pages/
    ├── Login.jsx
    ├── Dashboard.jsx
    ├── JobsList.jsx / JobNewEdit.jsx / JobDetail.jsx
    ├── ClientsList.jsx / ClientDetail.jsx
    ├── DevicesList.jsx / DeviceDetail.jsx
    ├── Finance.jsx
    ├── Templates.jsx
    ├── AuditLog.jsx                # /audit (admin)
    ├── Users.jsx                   # /users (admin)
    ├── Reports.jsx                 # /reports (+ /reports/job/:id)
    └── Settings.jsx
```

Routing (in `App.js`) is wrapped in `<AuthProvider>`. `/login` is public; everything else is behind `<ProtectedShell>`.

---

## 4. Backend structure

Root: `/app/backend/`

```
├── server.py                       # FastAPI app, CORS, middleware, /api prefix, includes routers
├── auth.py                         # JWT, Argon2id, role helpers (require_role / require_min_role)
├── audit.py                        # log_event() – appends to audit_log
├── crypto_utils.py                 # AES-256-GCM encrypt/decrypt for secrets
├── models.py                       # Pydantic models (User, Client, Job, Device, FinanceInfo, ...)
├── seed.py                         # Idempotent seed: admin user, predefined templates, demo data
└── routes/
    ├── auth_routes.py              # /api/auth/*
    ├── users_routes.py             # /api/users/* (admin only)
    ├── audit_routes.py             # /api/audit/*
    ├── clients_routes.py           # /api/clients/*
    ├── devices_routes.py           # /api/devices/*
    ├── jobs_routes.py              # /api/jobs/* (+ checklist / timeline / finance / secrets)
    ├── templates_routes.py         # /api/templates/* (admin edits)
    ├── uploads_routes.py           # /api/uploads (upload) + /api/files/{id} (authenticated fetch)
    ├── settings_routes.py          # /api/settings
    ├── dashboard_routes.py         # /api/dashboard/{stats,finance}
    └── search_routes.py            # /api/search (global Cmd-K)
```

All routers are prefixed with `/api` in `server.py` — the Kubernetes ingress routes `/api/*` to backend :8001 and everything else to frontend :3000.

---

## 5. Database — MongoDB collections

Everything uses UUIDv4 `id` fields (never `_id` in API responses).

### `users`
```
{ id, username, email, password_hash (Argon2id),
  name, role: "admin"|"collaborator"|"spectator",
  is_active: bool, must_change_password: bool,
  last_login_at: iso, created_at: iso }
```

### `clients`
```
{ id, full_name, phone, email, address, notes, trust_notes, created_at }
```

### `devices`
```
{ id, name, device_type, brand, model, serial, client_id,
  specs: {...}, notes, status, photos: [], created_at }
```

### `templates` (predefined + user-created)
```
{ id, name, category, description, fields: [CustomFieldDef],
  checklist: [str], timeline_types: [str], attachment_categories: [str],
  supports_devices, supports_secrets, is_predefined, created_at }
```
CustomFieldDef: `{ key, label, type ("text"|"textarea"|"select"|"checkbox"|"date"|"url"|"number"), required, options: [], placeholder }`

### `jobs`
```
{ id, code ("HL-0001"), title, template_id, category,
  status, priority, client_id, device_id,
  received_date, deadline, completed_date,
  description, internal_notes, customer_summary,
  tags: [str], custom_fields: { key: value },
  checklist: [ChecklistItem], timeline: [TimelineEntry],
  finance: FinanceInfo,
  secrets: [SecretItem],          # encrypted; only "label" + "created_at" exposed by default
  attachments: [Attachment],      # url = /api/files/{attachment_id}
  created_at, updated_at }
```

FinanceInfo (iter6):
```
{ labor_price, parts_price, discount,          # customer-side
  parts_cost, other_costs,                     # internal (not shown to customer / spectator)
  currency, payment_status: "Unpaid"|"Partial"|"Paid",
  payment_method, payment_date, payment_note, paid_amount }
```
Profit = `paid_amount - (parts_cost + other_costs)`.

SecretItem: `{ id, label, ciphertext, nonce, created_at }` — decrypted only on `POST /reveal` with admin password confirmation.

### `settings`
Single document with `_id: "app"`. Fields: `brand_name, accent_color, currency, logo_url, language, updated_at`.

### `audit_log`
```
{ id, created_at, event, user_id, username, ip, user_agent,
  entity_type, entity_id, entity_label, meta: {...}, success: bool }
```
Events currently logged: `login.success`, `login.failed`, `logout`, `password.changed`, `profile.updated`, `secret.created`, `secret.revealed`, `secret.reveal_denied`, `secret.copied`, `secret.deleted`, `attachment.uploaded`, `attachment.deleted`, `file.viewed`, `job.deleted`, `client.deleted`, `device.deleted`, `settings.updated`, `user.created`, `user.updated`, `user.role_changed`, `user.password_reset`, `user.deleted`.

---

## 6. Authentication & user roles

- **Passwords**: Argon2id via `argon2-cffi`. Legacy bcrypt hashes verify via fallback and are transparently rehashed on next login.
- **Tokens**: JWT (PyJWT, HS256, `JWT_SECRET`). Returned in login response body **and** as httpOnly `access_token` cookie. `identifier` accepts either username or email.
- **Rate limit**: `slowapi` on `/api/auth/login` — default 8/minute (`LOGIN_RATE_LIMIT` env).
- **Must-change-password**: `must_change_password=True` (either flag or default password detected on login) surfaces a sticky red banner + Settings notice until changed.
- **Forced logout**: rotating `JWT_SECRET` invalidates all sessions.

### Roles (iter6)

| Role | Sees Finance | Reveal secrets | Delete entities | Manage users | Manage templates | Uploads/edits |
|---|---|---|---|---|---|---|
| **admin** | ✅ | ✅ (own pwd conf.) | ✅ | ✅ | ✅ | ✅ |
| **collaborator** | ✅ | ❌ (masked only) | ❌ | ❌ | ❌ | ✅ create/update, no delete |
| **spectator** | ❌ (`/dashboard/finance` → 403; stats stripped) | ❌ | ❌ | ❌ | ❌ | ❌ read-only |

Role enforcement helpers in `auth.py`:
- `Depends(require_role("admin"))` — one of listed roles
- `Depends(require_min_role("collaborator"))` — rank ≥ (spectator=1, collaborator=2, admin=3)

Frontend hides nav items for lower roles (`AppShell.jsx`), but security is enforced server-side.

**Last-admin guard**: cannot demote/deactivate/delete the last active admin (`users_routes.py`).

---

## 7. API endpoints

All under `/api` prefix. Auth via `Authorization: Bearer <token>` header **or** httpOnly cookie.

### Auth (`/api/auth`)
- `POST /login` `{identifier, password, remember}` → `{token, user}`; sets cookie; updates `last_login_at`. Rate limited.
- `POST /logout` → clears cookie
- `GET /me` → current user (excl. `password_hash`)
- `POST /change-password` `{current_password, new_password}`
- `POST /profile` `{username?, name?, email?}` — uniqueness checked; audit-logged

### Users (`/api/users`) — **admin only**
- `GET /` list
- `POST /` create `{username, email, password (≥10), name, role, is_active}`
- `PUT /{user_id}` update `{username?, email?, name?, role?, is_active?}`
- `POST /{user_id}/reset-password` `{new_password}`
- `DELETE /{user_id}`

### Jobs (`/api/jobs`)
- `GET /`, `POST /`, `GET /{id}`, `PUT /{id}` (collab+), `DELETE /{id}` (admin)
- `POST /{id}/checklist`, `PUT /{id}/checklist/{item}`, `DELETE /{id}/checklist/{item}` (collab+)
- `POST /{id}/timeline`, `DELETE /{id}/timeline/{entry}` (collab+)
- `PUT /{id}/finance` (collab+)
- `POST /{id}/secrets` (collab+), `POST /{id}/secrets/{sid}/reveal` (**admin only**, requires password body), `DELETE /{id}/secrets/{sid}` (admin), `POST /{id}/secrets/{sid}/copied` (audit only)

### Clients / Devices / Templates
- `GET`, `POST`, `GET /{id}`, `PUT /{id}` (collab+), `DELETE /{id}` (admin)
- Templates: create/update/delete admin only; predefined templates cannot be deleted.

### Uploads (`/api/uploads`, `/api/files`)
- `POST /api/uploads` (multipart) — collab+; **25 MB cap**; MIME + extension denylist (`.exe`, `.sh`, `.php`, etc.)
- `DELETE /api/uploads/{attachment_id}` — collab+
- `GET /api/files/{attachment_id}` — auth required; logs `file.viewed`; `X-Content-Type-Options: nosniff`

### Dashboard
- `GET /api/dashboard/stats?range=today|week|month|6m|year|all|custom&from&to` — counts, revenue, profit, series, activity, recent clients/devices, upcoming
- `GET /api/dashboard/finance?range=...` — total_revenue, total_profit, avg_job_value, avg_profit, by_category, series (revenue+profit), paid/unpaid lists. **403 for spectator**.

### Audit (`/api/audit`) — admin only via nav; endpoint requires any authed user
- `GET /` filters: `event, username, q (regex), range, from, to, limit≤1000`
- `GET /meta` distinct events + usernames
- `GET /summary?range=day` counts per event family (used by Dashboard SecurityCard)

### Settings & Search
- `GET /api/settings`, `PUT /api/settings`
- `GET /api/search?q=...` — global search jobs/clients/devices

---

## 8. Important files & what they do

| File | Role |
|---|---|
| `/app/backend/server.py` | FastAPI setup, CORS, security headers middleware, router mounting, startup/shutdown hooks calling `seed.run_seeders()`. |
| `/app/backend/auth.py` | Password hashing (Argon2id), JWT create/verify, cookie setter, `get_current_user`, `require_role`, `require_min_role`, `client_ip`, `user_agent`. |
| `/app/backend/audit.py` | `log_event(db, event, ...)` — non-throwing, best-effort insert into `audit_log`. |
| `/app/backend/crypto_utils.py` | AES-256-GCM with `ENCRYPTION_KEY` (base64 32 bytes). `encrypt_secret / decrypt_secret / mask_secret`. **Losing this key = losing every stored secret.** |
| `/app/backend/models.py` | All Pydantic input/output shapes. Modify carefully — many endpoints validate via these. |
| `/app/backend/seed.py` | Idempotent by name: creates admin (`ADMIN_USERNAME`/`ADMIN_PASSWORD` env), 19 predefined templates, settings doc, and demo data (only if `clients` is empty). |
| `/app/frontend/src/lib/api.js` | Axios instance with `withCredentials: true`, `Authorization` header injector, response interceptor for 401→logout. `downloadFile(url, name)` for auth-protected file download. |
| `/app/frontend/src/context/AuthContext.jsx` | Login/logout/refresh; auto-loads `/auth/me` on mount. |
| `/app/frontend/src/components/houston/AppShell.jsx` | Sidebar + role-gated nav (`hideForRoles`, `minRole`), TopBar with global Cmd-K search dialog. |
| `/app/frontend/src/components/houston/RangePicker.jsx` | Reusable date range component. `rangeParams(value)` → query params; `formatBucketLabel(bucket)` → human date. |
| `/app/frontend/src/components/houston/MoneyInput.jsx` | String-backed money input; selects-all on focus if value is 0; commits to 0 on blur if empty. |
| `/app/frontend/src/components/houston/AuthImage.jsx` | Fetches `/api/files/{id}` via axios blob so browser cache + Bearer header both work. Use everywhere images from `/api/files/...` are displayed. |
| `/app/frontend/src/components/houston/SecurityCard.jsx` | Dashboard 24h widget reading `/api/audit/summary`. |
| `/app/frontend/src/pages/JobDetail.jsx` | Big tabbed job view (Overview / Timeline / Checklist / Files / Gallery / Device / Client / Finance / Secrets / Notes). Contains `FinanceTab`, `SecretsTab`, `GalleryTab`, `FilesTab`. |
| `/app/frontend/src/pages/Reports.jsx` | Customer report / job sheet. Print CSS in `index.css` at the bottom (`@media print`) does the heavy lifting. |
| `/app/frontend/src/i18n/{en,cs}.js` | Every UI string. Keep keys aligned. When adding a string, add it to **both**. |

---

## 9. Completed features (iteration by iteration)

### MVP (iter1)
- Login (JWT + bcrypt at the time)
- 12 predefined job templates
- Dynamic job form driven by templates
- Full CRUD: clients, devices, jobs, templates, settings
- Job detail with 10 tabs (Overview / Timeline / Checklist / Files / Gallery / Device / Client / Finance / Secrets / Notes)
- Timeline (8 entry types), checklist, secrets vault (reveal/copy/hide + admin password confirmation), file uploads to persistent volume
- Dashboard KPIs, monthly revenue chart, recent activity, upcoming deadlines
- Finance page (revenue chart, category breakdown, unpaid list)
- Global Cmd-K search
- Settings (brand, accent color, currency, profile, password change)
- Demo data (6 clients, 7 devices, 7 jobs)
- English + Czech UI

### Security hardening (iter2)
- Argon2id password hashing (legacy bcrypt fallback with transparent rehash)
- slowapi rate limit on login
- Audit log foundation
- `/api/files/{id}` requires auth
- Security headers (X-Frame-Options DENY, Referrer-Policy, HSTS in prod)
- Production hardening: `APP_ENV=production` hides docs/openapi, secures cookies

### Frontend refinements (iter2/3)
- Login polish (blur reduced, badges + default credentials removed)
- Dashboard + Finance date range selectors (Today / Week / Month / 6m / Year / All / Custom)
- Custom-range dialog (`shadcn Dialog` + 50 ms defer)
- `<AuthImage>` for gallery, `downloadFile` for Files tab
- Force-password-change banner + Settings notice

### Audit + polish (iter4)
- Read-only Audit Log page at `/audit`
- `/api/audit` filters (event, username, q, range, from, to, limit); `/api/audit/meta`
- `file.viewed` audit event on every file fetch
- Range option order unified across pages
- Recharts initial-tooltip suppression

### Security card + secret.copied (iter5)
- Dashboard SecurityCard (24 h summary)
- `POST /api/jobs/{id}/secrets/{sid}/copied` — audit only, never stores value

### RBAC + Profit + Templates + Reports + MoneyInput (iter6)
- `admin` / `collaborator` / `spectator` roles enforced server-side
- `/users` admin CRUD (with last-admin guard, deactivate, password reset)
- Username editable in Settings
- `last_login_at` tracked
- Profit tracking (`parts_cost`, `other_costs`); Finance page KPI + 2-series chart + per-category profit; JobDetail summary card; Dashboard profit hint
- MoneyInput (clear-to-0 UX)
- Template splits: Laptop Repair / Laptop Cleaning, Console Cleaning, General Network Setup / UniFi Setup, NAS Setup / Server Setup (legacy templates kept for old jobs)
- Customer report page `/reports` (+ button on JobDetail), print → Save as PDF

---

## 10. Unfinished features / backlog

### P1
1. **Server-side PDF export** for the customer report (WeasyPrint or Playwright-render). Print → Save as PDF works now; user approved both.
2. **Photo before/after slider** in gallery.
3. **Bulk actions** in Jobs list (status change, archive).
4. **Custom template editor UI** (currently admin edits templates via API only).
5. **Webhooks / Telegram notifications** on status change.
6. **Migrate `@app.on_event`** to FastAPI `lifespan`.
7. **Lock CORS `allow_origins`** to explicit list when `allow_credentials=True`.
8. **Fix two legacy backend tests** in `backend_test.py::TestAuth::test_login_with_username / test_login_with_email` — they hardcode `admin@houstonlab.local` but the admin email has been changed. Should read `/auth/me` first.
9. **Top-profit-categories widget** on Dashboard (was suggested at end of iter6; not built).

### P2
- Time-tracking per job.
- Auto-generated invoice page (customer-facing).
- Multi-tenant isolation (if partner technician onboarding).
- Restrict "block default password" policy to seeded admin only (currently global heuristic).

---

## 11. Known bugs / minor issues

| # | Where | Symptom | Impact | Notes |
|---|---|---|---|---|
| 1 | `backend_test.py::TestAuth` (2 tests) | Fail because admin email in DB is `JanPilat.bp@gmail.com`, not the hardcoded `admin@houstonlab.local` | Test data drift only; app itself is fine | Fix per P1 #8 above. |
| 2 | Recharts on some list pages | Console warning `width(-1) and height(-1) of chart should be greater than 0` on first paint | Cosmetic only | Comes from ResponsiveContainer being measured before layout. Safe to ignore. |
| 3 | `SecurityCard.jsx` | Swallows any `/audit/summary` error silently | Card just doesn't render numbers | Fine for a widget; log if you care. |
| 4 | Existing FinanceInfo docs may lack `parts_cost`/`other_costs` fields | Frontend defaults them to 0 via Pydantic | No visible issue | On save, backend writes the full FinanceInfo model — they'll be present after next edit. |
| 5 | `users_routes.update_user` accepts `role: null` silently as no-op | Very minor UX — no bad state possible | Client just needs to omit the field to skip. |
| 6 | `dashboard_routes._job_profit` defined but only used by `/stats` — `/finance` inlines the same formula | Formula duplication risk if changed later | Consolidate if you edit profit math. |

**Note:** no critical/blocking bugs.

---

## 12. Design style / UI rules

**Do not redesign.** The user has repeatedly and explicitly asked to preserve the current visual direction.

Concrete rules:
- **Colors** (CSS vars in `index.css`): `--hl-bg` dark graphite, `--hl-card`, `--hl-elevated`, `--hl-border`, `--hl-border-subtle`, `--hl-input`, `--hl-sidebar`. Accent = emerald (`emerald-400/500`). Errors use red-300/500 on 10% backgrounds.
- **Fonts**: Geist (default), JetBrains Mono via `hl-mono` class for codes/monospace numbers.
- **Header pattern**: `hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80` kicker + big semibold title + `text-sm text-zinc-500` subtitle.
- **Cards**: `hl-card` utility (padded, rounded, dark background, subtle border).
- **KPIs**: `.hl-stat-card` (top-right icon in `bg-*-500/10 text-*-300` tinted square).
- **Badges** (statuses/priorities/payments/roles): pill with border + `hl-mono text-[10px] uppercase tracking-widest`.
- **Interactive elements MUST have `data-testid`** — kebab-case describing function, unique per element. See existing pages for examples.
- **shadcn components** are the primary primitives — reuse instead of building custom.
- **Print CSS** (bottom of `index.css`) hides sidebar/topbar/banner and flips report to white background.
- **Tables**: `min-w-full text-sm` with sticky header + column headers in `hl-mono text-[10px] uppercase tracking-widest text-zinc-500`.
- **Empty states**: use `<EmptyState>` component.
- **Icons**: `lucide-react` only. Never emoji.

---

## 13. Things that must NOT be changed

- ✋ **`REACT_APP_BACKEND_URL`, `MONGO_URL`, `DB_NAME`** — protected variables managed by the platform.
- ✋ **`ENCRYPTION_KEY`** — losing / rotating this makes every encrypted secret in the DB unreadable. Back it up offline.
- ✋ **Existing FinanceInfo field names** (`labor_price`, `parts_price`, `discount`, `parts_cost`, `other_costs`, `paid_amount`, `payment_status`, `payment_method`, `payment_date`, `payment_note`, `currency`). Renaming breaks all existing job docs.
- ✋ **Existing role names** (`admin` / `collaborator` / `spectator`). Adding new roles is fine; renaming or removing is not.
- ✋ **Existing template names** (including the legacy `Laptop Service`, `Console Service`, `NAS / Server Setup`, `Networking / UniFi Setup`). They stay so old jobs still map. Add new templates; do NOT delete old ones.
- ✋ **`/api` prefix** on every backend route.
- ✋ **Audit event names**. Loggers key off strings — renaming an event breaks the filter dropdown and history queries.
- ✋ **Design language** (colors, spacing, kicker/title/subtitle pattern, sidebar layout). User has said "Do not redesign" repeatedly.
- ✋ **Secrets tab reveal flow** — admin password re-confirmation is a security control; never bypass.
- ✋ **Reports page exclusions** — `internal_notes` and `secrets` must never render on the customer-facing report.
- ✋ **`/api/files/{id}` auth requirement** — every image/attachment is protected.

---

## 14. Deployment / environment variables

### Backend `.env` (`/app/backend/.env`)
| Variable | Purpose |
|---|---|
| `MONGO_URL` | MongoDB connection string (protected) |
| `DB_NAME` | Database name (protected) |
| `CORS_ORIGINS` | Comma-separated allowed origins (currently `*` — tighten before public deploy) |
| `JWT_SECRET` | 32+ random bytes; rotating logs everyone out |
| `ENCRYPTION_KEY` | Base64-encoded 32-byte AES-256-GCM key — **back up offline** |
| `ADMIN_USERNAME` | Default admin username (`admin`) |
| `ADMIN_EMAIL` | Default admin email |
| `ADMIN_PASSWORD` | Default admin password (only used if no admin exists yet) |
| `UPLOAD_DIR` | Where files are stored (`/app/data/uploads`) — mounted as a Docker volume |
| `FRONTEND_URL` | Used for CORS + cookie domain |
| `APP_ENV` | `development` or `production` — production hides docs, enables HSTS/secure cookies |
| `COOKIE_SECURE` | Explicit override for cookie `Secure` flag |
| `LOGIN_RATE_LIMIT` | slowapi budget (default `8/minute`) |

### Frontend `.env` (`/app/frontend/.env`)
| Variable | Purpose |
|---|---|
| `REACT_APP_BACKEND_URL` | Full public URL of the API (protected — do not change in preview) |
| `WDS_SOCKET_PORT` | WebSocket port for hot reload |
| `ENABLE_HEALTH_CHECK` | Turn off in preview |

### Supervisor
- `sudo supervisorctl status` — check services
- `sudo supervisorctl restart backend|frontend|all` — needed **only** after `.env` or dependency change (hot reload otherwise)
- Backend logs: `tail -n 100 /var/log/supervisor/backend.*.log`

### Docker Compose (self-host)
- `docker compose up -d` in `/app`
- MongoDB volume + `/app/data/uploads` volume
- Recommended posture: LAN / VPN only, HTTPS terminator (Caddy/Nginx) in front, `APP_ENV=production`, `CORS_ORIGINS=<your-domain>` (never `*` with credentials).

---

## 15. Next recommended steps

Following the user's stated priorities (stability > new features > redesign):

1. **Fix the 2 legacy `backend_test.py` auth tests** (P1 #8). ~10 min. Ensures the regression suite returns to 100 % green.
2. **Server-side PDF for the customer report** (P1 #1). Adds `POST /api/reports/job/{id}/pdf` using WeasyPrint. Frontend already has the print layout; just render server-side with the same HTML.
3. **Top-profit-categories widget on Dashboard** (~30 min). Uses existing `/api/dashboard/finance` data; shows the 3 best-margin categories over the last 6 months.
4. **Custom template editor UI** (P1 #4). Big value — user currently can't add new job types without an agent.
5. **Bulk actions in Jobs list** (P1 #3). Multi-select checkboxes + status batch update.
6. **Photo before/after slider** in gallery (P1 #2). Pure frontend.
7. **CORS lockdown + `@app.on_event` migration** (P1 #6 + #7). Tech-debt cleanup; do together.

### Rules for the next agent
- **Never redesign** the UI. Keep the emerald/graphite dark theme, kicker/title/subtitle pattern, and sidebar structure.
- **Always add `data-testid`** to new interactive elements.
- **Add strings to both `en.js` and `cs.js`** whenever you add UI text.
- **Prefer editing existing files** over creating new ones; use `search_replace` for edits.
- **Run `testing_agent_v3_fork`** after any batch of changes to ensure regression coverage.
- **Keep the security work intact** — Argon2id, audit logging, `require_role`/`require_min_role`, protected file endpoints. Every new write endpoint should apply role guards.
- **Never expose secrets in the customer report**, on any new page, or in logs. The `secret.copied` endpoint stores label + entity ids only, never the value — follow the same pattern for any new secret-adjacent feature.
- **Idempotent seed**: if you add a new predefined template, add it to `PREDEFINED_TEMPLATES` in `seed.py` — the upsert-by-name logic will add it on next startup without touching existing templates.
- **Update `/app/memory/PRD.md`** and this handover document when you complete meaningful work.

---

**End of handover.** Everything above reflects the state on May 1, 2026, after iteration 6. Related files: `/app/memory/PRD.md` (product requirements), `/app/memory/test_credentials.md` (login info + role notes), `/app/test_reports/iteration_*.json` (test history).
