import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { useT } from "../i18n/I18nContext";
import { fmtDateTime, fmtRelative } from "../lib/format";
import RangePicker, { rangeParams } from "../components/houston/RangePicker";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { EmptyState } from "../components/houston/EmptyState";
import {
    ShieldCheck, ShieldAlert, ShieldX, LogIn, LogOut, KeyRound, Eye, EyeOff,
    Upload, Trash2, FileText, Settings as SettingsIcon, RefreshCw, User2, Search,
} from "lucide-react";

// (icon, accent) per event family — accent maps to a tailwind text/bg colour pair.
const EVENT_META = {
    "login.success":        { icon: LogIn,         tone: "emerald" },
    "login.failed":         { icon: ShieldAlert,   tone: "red" },
    "logout":               { icon: LogOut,        tone: "zinc" },
    "password.changed":     { icon: KeyRound,      tone: "emerald" },
    "profile.updated":      { icon: User2,         tone: "cyan" },
    "secret.created":       { icon: KeyRound,      tone: "emerald" },
    "secret.revealed":      { icon: Eye,           tone: "amber" },
    "secret.reveal_denied": { icon: ShieldX,       tone: "red" },
    "secret.copied":        { icon: KeyRound,      tone: "amber" },
    "secret.deleted":       { icon: Trash2,        tone: "red" },
    "attachment.uploaded":  { icon: Upload,        tone: "cyan" },
    "attachment.deleted":   { icon: Trash2,        tone: "red" },
    "file.viewed":          { icon: Eye,           tone: "zinc" },
    "job.deleted":          { icon: Trash2,        tone: "red" },
    "client.deleted":       { icon: Trash2,        tone: "red" },
    "device.deleted":       { icon: Trash2,        tone: "red" },
    "settings.updated":     { icon: SettingsIcon,  tone: "indigo" },
};

const TONE_CLASS = {
    emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    red:     "bg-red-500/10 text-red-300 border-red-500/30",
    cyan:    "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    indigo:  "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
    amber:   "bg-amber-500/10 text-amber-300 border-amber-500/30",
    zinc:    "bg-zinc-500/10 text-zinc-300 border-zinc-500/30",
};

function EventBadge({ event, t }) {
    const meta = EVENT_META[event] || { icon: ShieldCheck, tone: "zinc" };
    const Icon = meta.icon;
    const klass = TONE_CLASS[meta.tone] || TONE_CLASS.zinc;
    const i18nKey = `audit.events.${event}`;
    const label = t(i18nKey) === i18nKey ? event : t(i18nKey);
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] hl-mono uppercase tracking-widest border ${klass}`}>
            <Icon className="h-3 w-3" />
            {label}
        </span>
    );
}

function MetaPills({ row }) {
    const m = row.meta || {};
    const pills = [];
    if (m.job_id) pills.push(`job:${String(m.job_id).slice(0, 8)}`);
    if (m.device_id) pills.push(`device:${String(m.device_id).slice(0, 8)}`);
    if (m.size) pills.push(`${Math.round((m.size || 0) / 1024)} KB`);
    if (m.mime) pills.push(m.mime);
    if (Array.isArray(m.fields) && m.fields.length) pills.push(`fields: ${m.fields.join(", ")}`);
    if (!pills.length) return <span className="text-zinc-600">—</span>;
    return (
        <div className="flex flex-wrap gap-1">
            {pills.map((p, i) => (
                <span key={i} className="hl-mono text-[10px] text-zinc-400 bg-[var(--hl-elevated)] border border-[var(--hl-border-subtle)] px-1.5 py-0.5 rounded">
                    {p}
                </span>
            ))}
        </div>
    );
}

export default function AuditLog() {
    const t = useT();
    const [range, setRange] = useState({ key: "month" });
    const [eventFilter, setEventFilter] = useState("__all");
    const [userFilter, setUserFilter] = useState("__all");
    const [q, setQ] = useState("");
    const [meta, setMeta] = useState({ events: [], users: [] });
    const [rows, setRows] = useState(null);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const params = { ...rangeParams(range), limit: 500 };
            if (eventFilter !== "__all") params.event = eventFilter;
            if (userFilter !== "__all") params.username = userFilter;
            if (q.trim()) params.q = q.trim();
            const r = await api.get("/audit", { params });
            setRows(r.data || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        (async () => {
            try {
                const r = await api.get("/audit/meta");
                setMeta(r.data || { events: [], users: [] });
            } catch { /* noop */ }
        })();
    }, []);

    useEffect(() => {
        const id = setTimeout(load, 200);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [range, eventFilter, userFilter, q]);

    const eventLabel = (e) => {
        const k = `audit.events.${e}`;
        const v = t(k);
        return v === k ? e : v;
    };

    const sortedEvents = useMemo(() => [...(meta.events || [])].sort(), [meta.events]);

    return (
        <div className="space-y-6 hl-fade-up">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1.5">{t("audit.kicker")}</div>
                    <h1 className="text-3xl font-semibold tracking-tight text-white">{t("audit.title")}</h1>
                    <p className="text-sm text-zinc-500 mt-1">{t("audit.subtitle")}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <RangePicker value={range} onChange={setRange} testId="audit-range" />
                    <Button
                        data-testid="audit-refresh"
                        variant="outline"
                        className="border-[var(--hl-border)] bg-[var(--hl-card)] hover:bg-[var(--hl-elevated)] gap-2"
                        onClick={load}
                        disabled={loading}
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {t("audit.refresh")}
                    </Button>
                </div>
            </div>

            <div className="hl-card p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                    <Select value={eventFilter} onValueChange={setEventFilter}>
                        <SelectTrigger data-testid="audit-filter-event" className="bg-[var(--hl-input)] border-[var(--hl-border)]">
                            <SelectValue placeholder={t("audit.filter.event")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all">{t("audit.filter.event")}</SelectItem>
                            {sortedEvents.map((e) => (
                                <SelectItem key={e} value={e} data-testid={`audit-filter-event-opt-${e}`}>{eventLabel(e)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="md:col-span-1">
                    <Select value={userFilter} onValueChange={setUserFilter}>
                        <SelectTrigger data-testid="audit-filter-user" className="bg-[var(--hl-input)] border-[var(--hl-border)]">
                            <SelectValue placeholder={t("audit.filter.user")} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all">{t("audit.filter.user")}</SelectItem>
                            {(meta.users || []).map((u) => (
                                <SelectItem key={u.username} value={u.username}>{u.username}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="md:col-span-1 relative">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    <Input
                        data-testid="audit-filter-search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={t("audit.filter.search")}
                        className="bg-[var(--hl-input)] border-[var(--hl-border)] pl-9"
                    />
                </div>
            </div>

            {rows && rows.length === 0 ? (
                <EmptyState icon={ShieldCheck} title={t("audit.empty_title")} description={t("audit.empty_desc")} />
            ) : (
                <div className="hl-card overflow-hidden" data-testid="audit-table">
                    <table className="min-w-full text-sm">
                        <thead className="border-b border-[var(--hl-border-subtle)] sticky top-0 bg-[var(--hl-card)]/95 backdrop-blur z-10">
                            <tr className="text-left">
                                <th className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500 w-44">{t("audit.col.time")}</th>
                                <th className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500 w-56">{t("audit.col.event")}</th>
                                <th className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500 w-32">{t("audit.col.user")}</th>
                                <th className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500">{t("audit.col.entity")}</th>
                                <th className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500 w-40">{t("audit.col.ip")}</th>
                                <th className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500">{t("audit.col.details")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(rows || []).map((r) => (
                                <tr key={r.id} data-testid={`audit-row-${r.id}`} className="border-b border-[var(--hl-border-subtle)] last:border-0 hover:bg-[var(--hl-elevated)]/50">
                                    <td className="px-5 py-3 align-top">
                                        <div className="hl-mono text-xs text-zinc-300">{fmtDateTime(r.created_at)}</div>
                                        <div className="text-[10px] text-zinc-600 hl-mono">{fmtRelative(r.created_at)}</div>
                                    </td>
                                    <td className="px-5 py-3 align-top">
                                        <div className="flex items-center gap-2">
                                            <EventBadge event={r.event} t={t} />
                                            {r.success === false && (
                                                <span className="hl-mono text-[10px] text-red-400">·{t("audit.failed")}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 align-top">
                                        <span className="text-zinc-200">{r.username || "—"}</span>
                                    </td>
                                    <td className="px-5 py-3 align-top">
                                        {r.entity_label ? (
                                            <div>
                                                <div className="text-zinc-200 truncate max-w-[260px]">{r.entity_label}</div>
                                                {r.entity_type && <div className="hl-mono text-[10px] text-zinc-500">{r.entity_type}</div>}
                                            </div>
                                        ) : r.entity_id ? (
                                            <div>
                                                <div className="hl-mono text-[10px] text-zinc-400 truncate max-w-[260px]">{r.entity_id}</div>
                                                {r.entity_type && <div className="hl-mono text-[10px] text-zinc-600">{r.entity_type}</div>}
                                            </div>
                                        ) : (
                                            <span className="text-zinc-600">—</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 align-top">
                                        <span className="hl-mono text-xs text-zinc-300">{r.ip || "—"}</span>
                                        {r.user_agent && (
                                            <div className="hl-mono text-[10px] text-zinc-600 truncate max-w-[200px]" title={r.user_agent}>
                                                {r.user_agent.slice(0, 36)}{r.user_agent.length > 36 ? "…" : ""}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 align-top">
                                        <MetaPills row={r} />
                                    </td>
                                </tr>
                            ))}
                            {rows === null && (
                                <tr><td colSpan={6} className="px-5 py-8 text-center text-zinc-500 text-sm">{t("common.loading")}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
