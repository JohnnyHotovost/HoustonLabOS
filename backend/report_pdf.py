"""Server-side Customer Job Sheet PDF generation.

Mirrors the *print* appearance of the frontend Reports view (Reports.jsx) —
same sections, labels, ordering, spacing and light-theme document look — using
a WeasyPrint-rendered HTML template. Reuses the exact same job/client/device
data and the same total calculation as the print view.

Strict exclusions (identical to the web report): internal_notes, secrets,
audit/system info.
"""
import base64
import html
import os
from datetime import datetime, timezone
from pathlib import Path

from weasyprint import HTML

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/data/uploads")).resolve()

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _esc(v) -> str:
    return html.escape("" if v is None else str(v))


def fmt_money(amount, currency: str = "CZK") -> str:
    """Match frontend fmtMoney: Number.toLocaleString('cs-CZ') + ' ' + currency."""
    try:
        n = int(round(float(amount or 0)))
    except (TypeError, ValueError):
        n = 0
    grouped = f"{n:,}".replace(",", "\u00a0")  # cs-CZ groups thousands with NBSP
    return f"{grouped} {currency}"


def fmt_datetime(value) -> str:
    """Match frontend fmtDateTime: 'MMM d, yyyy · HH:mm'."""
    if not value:
        return "—"
    try:
        if isinstance(value, str):
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        else:
            dt = value
        return f"{MONTHS[dt.month - 1]} {dt.day}, {dt.year} · {dt.hour:02d}:{dt.minute:02d}"
    except Exception:
        return "—"


def _photo_data_uri(att: dict) -> str | None:
    fname = att.get("filename", "")
    if not fname or "/" in fname or "\\" in fname or ".." in fname:
        return None
    target = (UPLOAD_DIR / fname).resolve()
    if target.parent != UPLOAD_DIR or not target.exists():
        return None
    try:
        data = target.read_bytes()
    except Exception:
        return None
    mime = att.get("mime") or "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"


def _visible_photos(job: dict, include: bool) -> list[str]:
    if not include:
        return []
    uris = []
    for a in (job.get("attachments") or []):
        if not (a.get("mime") or "").startswith("image/"):
            continue
        if a.get("customer_visible") is False:
            continue
        uri = _photo_data_uri(a)
        if uri:
            uris.append(uri)
        if len(uris) >= 9:
            break
    return uris


CSS = """
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #18181b;
  font-size: 14px;
  line-height: 1.5;
  -weasy-hyphens: none;
}
.mono { font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace; }
.sheet { padding: 0; }
.eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: 0.3em; color: #047857; margin-bottom: 8px; }
.label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #71717a; }
header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #d4d4d8; padding-bottom: 24px; }
header .title { font-size: 24px; font-weight: 600; color: #18181b; }
header .subtitle { font-size: 14px; color: #71717a; margin-top: 4px; }
header .gen { text-align: right; }
header .gen .val { font-size: 14px; color: #3f3f46; }
section { margin-top: 32px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.grid4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; font-size: 14px; }
.field .label { margin-bottom: 8px; display: block; }
.field .val { color: #18181b; }
.field .sub { font-size: 12px; color: #71717a; }
.dates .val { color: #27272a; }
.summary-text { color: #27272a; white-space: pre-wrap; line-height: 1.625; }
.work-list { list-style: none; margin: 0; padding: 0; }
.work-list li { display: flex; gap: 8px; font-size: 14px; color: #27272a; margin-bottom: 6px; }
.work-list .wtype { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #71717a; width: 128px; flex-shrink: 0; }
.checklist-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.checklist { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; column-gap: 24px; row-gap: 4px; font-size: 14px; }
.checklist li { display: flex; align-items: center; gap: 8px; color: #27272a; }
.chk-box { display: inline-block; height: 12px; width: 12px; border-radius: 2px; border: 1px solid #a1a1aa; flex-shrink: 0; }
.chk-box.done { background: #10b981; border-color: #10b981; }
.chk-text.undone { opacity: 0.6; }
.photos { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.photos img { width: 100%; height: 150px; object-fit: cover; border: 1px solid #d4d4d8; }
.pricing { border-top: 1px solid #d4d4d8; padding-top: 24px; }
.price-grid { display: grid; grid-template-columns: 1fr 1fr; row-gap: 4px; max-width: 28rem; }
.price-grid .k { color: #3f3f46; }
.price-grid .v { text-align: right; color: #18181b; font-family: 'JetBrains Mono', ui-monospace, monospace; }
.price-grid .k.total, .price-grid .v.total { border-top: 1px solid #d4d4d8; padding-top: 8px; margin-top: 4px; }
.price-grid .k.total { color: #18181b; font-weight: 500; }
.price-grid .v.total { color: #047857; font-weight: 600; }
footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #d4d4d8; font-size: 12px; color: #71717a; display: flex; justify-content: space-between; font-family: 'JetBrains Mono', ui-monospace, monospace; }
.mt3 { margin-bottom: 12px; }
"""


def build_report_html(job: dict, client: dict | None, device: dict | None,
                       settings: dict | None, opts: dict) -> str:
    brand = (settings or {}).get("brand_name") or "HoustonLab"
    currency = (settings or {}).get("currency") or (job.get("finance") or {}).get("currency") or "CZK"
    fin = job.get("finance") or {}
    total = (fin.get("labor_price") or 0) + (fin.get("parts_price") or 0) - (fin.get("discount") or 0)

    checklist = job.get("checklist") or []
    checklist_done = sum(1 for c in checklist if c.get("done"))

    # --- header ---
    parts = [f'<div class="sheet">']
    parts.append('<header>')
    parts.append('<div>')
    parts.append(f'<div class="eyebrow">{_esc(brand)} · Customer Report</div>')
    parts.append(f'<div class="title">{_esc(job.get("title"))}</div>')
    parts.append(f'<div class="subtitle mono">{_esc(job.get("code"))} · {_esc(job.get("category"))}</div>')
    parts.append('</div>')
    parts.append('<div class="gen">')
    parts.append('<div class="label mono">Generated</div>')
    parts.append(f'<div class="val mono">{_esc(fmt_datetime(datetime.now(timezone.utc)))}</div>')
    parts.append('</div>')
    parts.append('</header>')

    # --- client + device ---
    parts.append('<section class="grid2">')
    parts.append('<div class="field">')
    parts.append('<span class="label mono">Client</span>')
    parts.append(f'<div class="val">{_esc((client or {}).get("full_name") or "—")}</div>')
    if client and client.get("phone"):
        parts.append(f'<div class="sub">{_esc(client["phone"])}</div>')
    if client and client.get("email"):
        parts.append(f'<div class="sub">{_esc(client["email"])}</div>')
    if client and client.get("address"):
        parts.append(f'<div class="sub">{_esc(client["address"])}</div>')
    parts.append('</div>')
    parts.append('<div class="field">')
    parts.append('<span class="label mono">Device</span>')
    if device:
        parts.append(f'<div class="val">{_esc(device.get("name"))}</div>')
        meta = " · ".join([x for x in [device.get("brand"), device.get("model"), device.get("device_type")] if x])
        parts.append(f'<div class="sub">{_esc(meta)}</div>')
        if device.get("serial"):
            parts.append(f'<div class="sub mono">SN: {_esc(device["serial"])}</div>')
    else:
        parts.append('<div class="val">—</div>')
    parts.append('</div>')
    parts.append('</section>')

    # --- dates + status ---
    parts.append('<section class="grid4 dates">')
    for lbl, val in [
        ("Received", fmt_datetime(job.get("received_date")) if job.get("received_date") else "—"),
        ("Completed", fmt_datetime(job.get("completed_date")) if job.get("completed_date") else "—"),
        ("Status", job.get("status") or "—"),
        ("Priority", job.get("priority") or "—"),
    ]:
        parts.append(f'<div><div class="label mono">{lbl}</div><div class="val">{_esc(val)}</div></div>')
    parts.append('</section>')

    # --- summary ---
    summary = job.get("customer_summary") or job.get("description")
    if summary:
        parts.append('<section>')
        parts.append('<div class="label mono mt3">Summary</div>')
        parts.append(f'<div class="summary-text">{_esc(summary)}</div>')
        parts.append('</section>')

    # --- work performed ---
    timeline = [e for e in (job.get("timeline") or [])
                if e.get("customer_visible") is not False and e.get("type") != "Note"][:12]
    if timeline:
        parts.append('<section>')
        parts.append('<div class="label mono mt3">Work performed</div>')
        parts.append('<ul class="work-list">')
        for e in timeline:
            parts.append(f'<li><span class="wtype">{_esc(e.get("type"))}</span><span>{_esc(e.get("text"))}</span></li>')
        parts.append('</ul>')
        parts.append('</section>')

    # --- checklist ---
    if opts.get("checklist") and checklist:
        parts.append('<section>')
        parts.append('<div class="checklist-head"><div class="label mono">Checklist</div>'
                     f'<div class="label mono">{checklist_done}/{len(checklist)} done</div></div>')
        parts.append('<ul class="checklist">')
        for c in checklist:
            done = bool(c.get("done"))
            box = 'chk-box done' if done else 'chk-box'
            txt = 'chk-text' if done else 'chk-text undone'
            parts.append(f'<li><span class="{box}"></span><span class="{txt}">{_esc(c.get("text"))}</span></li>')
        parts.append('</ul>')
        parts.append('</section>')

    # --- photos ---
    photos = _visible_photos(job, bool(opts.get("photos")))
    if photos:
        parts.append('<section>')
        parts.append('<div class="label mono mt3">Photos</div>')
        parts.append('<div class="photos">')
        for uri in photos:
            parts.append(f'<img src="{uri}" />')
        parts.append('</div>')
        parts.append('</section>')

    # --- pricing ---
    if opts.get("prices"):
        parts.append('<section class="pricing">')
        parts.append('<div class="label mono mt3">Price summary</div>')
        parts.append('<div class="price-grid">')
        parts.append(f'<div class="k">Labor</div><div class="v">{_esc(fmt_money(fin.get("labor_price"), currency))}</div>')
        parts.append(f'<div class="k">Parts</div><div class="v">{_esc(fmt_money(fin.get("parts_price"), currency))}</div>')
        if (fin.get("discount") or 0) > 0:
            parts.append(f'<div class="k">Discount</div><div class="v">\u2212{_esc(fmt_money(fin.get("discount"), currency))}</div>')
        parts.append(f'<div class="k total">Total</div><div class="v total">{_esc(fmt_money(total, currency))}</div>')
        parts.append(f'<div class="k">Payment</div><div class="v">{_esc(fin.get("payment_status") or "—")}</div>')
        parts.append('</div>')
        parts.append('</section>')

    # --- footer ---
    parts.append('<footer>')
    parts.append(f'<span>{_esc(brand)} · {_esc(job.get("code"))}</span>')
    parts.append('<span>Thank you for your trust.</span>')
    parts.append('</footer>')

    parts.append('</div>')

    body = "".join(parts)
    return f"<!doctype html><html><head><meta charset='utf-8'><style>{CSS}</style></head><body>{body}</body></html>"


def render_report_pdf(job: dict, client: dict | None, device: dict | None,
                      settings: dict | None, opts: dict) -> bytes:
    html_str = build_report_html(job, client, device, settings, opts)
    return HTML(string=html_str).write_pdf()
