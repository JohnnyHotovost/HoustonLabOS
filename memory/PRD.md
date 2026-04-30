# HoustonLab OS — PRD

## Original problem statement
Build a premium full-stack web application called **HoustonLab OS** — a private internal operations system for a technical service brand (PC builds, repairs, networking, NAS, Minecraft hosting, iPhone repair, etc.). Every job, client, device, file and payment is recorded as a structured technical case file with timeline, checklist, files, secrets and finance.

## Tech & Architecture
- **Backend**: FastAPI + MongoDB (motor), modular `routes/*.py`, JWT (PyJWT) + bcrypt auth, AES-256-GCM symmetric encryption (`cryptography`).
- **Frontend**: React 19 + Tailwind + shadcn/ui + Recharts + lucide-react. Geist + JetBrains Mono fonts, dark graphite theme.
- **Persistence**: MongoDB volume + local persistent file uploads (`/app/data/uploads`).
- **Deployment**: `docker-compose.yml` with MongoDB + backend + nginx-served frontend, persistent volume for uploads.

## Implemented (April 2026)
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

## Backlog (P1)
- Photo before/after comparison slider in gallery.
- Bulk actions in jobs list (set status, archive).
- Export client report PDF.
- Add custom template editor (currently fields/checklist editable only via API).
- Webhooks/notifications (email or telegram on job status change).

## Backlog (P2)
- Multi-user support with roles (technician/admin).
- Time-tracking per job.
- Auto-generated customer-facing invoice page.
