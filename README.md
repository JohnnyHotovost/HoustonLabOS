# HoustonLab OS

Private internal operating system for a technical-service brand —
PC builds, repairs, networking, NAS, hosting, Apple/iPhone, and more.
Every job, client, device, file, secret and payment is captured as a
structured technical case file with timeline, checklist, files and finance.

Stack: **FastAPI · MongoDB · React 19 · Tailwind · shadcn/ui**.
Encryption: **AES-256-GCM** (secrets) · **Argon2id** (passwords).

---

## Default credentials

```
admin / ChangeMe123!
```

The login screen will not display these. **Change the password immediately
after first sign-in** — a sticky red banner across the app reminds you until
you do.

---

## Security hardening (READ THIS BEFORE EXPOSING THE APP)

HoustonLab OS is designed for **trusted internal networks only**. Treat it
like a private operations console, not a public SaaS.

### Recommended deployment posture
- **LAN / VPN only.** Bind the service to a private interface or place it
  behind WireGuard/Tailscale. Do not publish `:8001` (backend) or `:3000`
  (frontend) directly to the internet.
- **HTTPS terminator in front.** If exposing through a reverse proxy
  (Caddy / Nginx / Traefik), enable HTTPS, HSTS, and forward
  `X-Forwarded-For` so audit logs capture real client IPs.
- **Set `APP_ENV=production`.** This disables `/docs`, `/redoc`,
  `/openapi.json`, hides stack traces from 500s, and turns on
  `Strict-Transport-Security`. It also flips `cookie_secure` on so the JWT
  cookie is only sent over TLS.
- **Pin CORS.** In production, set `CORS_ORIGINS=https://your-domain` —
  never leave it as `*` if credentials are involved.
- **Tune login rate limit.** `LOGIN_RATE_LIMIT` (default `8/minute`) is
  per-client-IP. Behind a proxy ensure `X-Forwarded-For` is set so a
  single bad actor cannot exhaust everyone else's quota.

### Secrets & encryption
- `SECRETS_MASTER_KEY` (base64 32 bytes) is the AES-256-GCM key used to
  encrypt secrets at rest. **Without it the secrets become unreadable.**
- **Back it up off-server.** A copy in your password manager + an offline
  printout in a safe is the minimum. If you rotate or lose this key,
  every stored secret becomes garbage. There is no recovery.
- `JWT_SECRET` should be 32+ random bytes. Rotating it logs everyone out
  (which is intended — do it after a suspected compromise).

### Backups
- **MongoDB.** `mongodump` against the running container daily; encrypt
  the dump with the same key-management discipline as
  `SECRETS_MASTER_KEY`.
- **Uploads.** `/app/data/uploads` is a Docker volume — include it in
  `restic` / `borg` / `tar` snapshots.
- **`.env` files.** The application is useless without `JWT_SECRET` +
  `SECRETS_MASTER_KEY` matching the encrypted DB. Back them up the same
  way you back up the DB.

### Audit log
Authentication events, secret reveals/creates/deletes, attachment
uploads/deletes and password changes are written to the `audit_log`
collection (`/api/audit`). Review periodically — anything unusual
(`secret.reveal_denied`, login.failed bursts) deserves attention.

### Files & uploads
- All `/api/files/{id}` reads require a valid session.
- Server-side filename is a random UUID; the original name is preserved
  only as metadata.
- 25 MB per-file cap; executables and scripts (`.exe`, `.sh`, `.php`, …)
  are rejected by extension regardless of MIME.
- `X-Content-Type-Options: nosniff` is set on every response.

---

## Running it

### Docker compose (recommended)
```
cp .env.example .env
# then edit JWT_SECRET, SECRETS_MASTER_KEY, MONGO_URL
docker compose up -d
```

### Local dev
- `cd backend && uvicorn server:app --reload --port 8001`
- `cd frontend && yarn && yarn start`

---

## Languages
English and Czech are first-class. Switch from **Settings → Language**.
