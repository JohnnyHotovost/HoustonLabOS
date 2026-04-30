import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { useT } from "../../i18n/I18nContext";
import { ShieldCheck, ShieldAlert, ArrowUpRight, LogIn, Eye, FileText, Trash2, KeyRound } from "lucide-react";

/**
 * Compact, calm security overview for the Dashboard.
 * Reads /api/audit/summary?range=day (last 24 h) and surfaces a few high-signal counts.
 */
export default function SecurityCard() {
    const t = useT();
    const [data, setData] = useState(null);

    useEffect(() => {
        let cancel = false;
        (async () => {
            try {
                const r = await api.get("/audit/summary", { params: { range: "day" } });
                if (!cancel) setData(r.data);
            } catch {
                if (!cancel) setData({ counts: {} });
            }
        })();
        return () => { cancel = true; };
    }, []);

    const c = data?.counts || {};
    const failed = c.login_failed || 0;
    const denied = c.secret_reveal_denied || 0;
    const abnormal = failed > 0 || denied > 0;
    const totalSignals =
        (c.login_success || 0) + failed + (c.secret_revealed || 0) +
        (c.file_viewed || 0) + (c.deletions || 0);

    const items = [
        { key: "login_success", icon: LogIn,       value: c.login_success || 0,   label: t("dashboard.security.kpi.login_success"), tone: "zinc" },
        { key: "login_failed",  icon: ShieldAlert, value: failed,                 label: t("dashboard.security.kpi.login_failed"),  tone: failed > 0 ? "red" : "zinc" },
        { key: "secret_revealed", icon: KeyRound,  value: c.secret_revealed || 0, label: t("dashboard.security.kpi.secret_revealed"), tone: (c.secret_revealed || 0) > 0 ? "amber" : "zinc" },
        { key: "file_viewed",   icon: FileText,    value: c.file_viewed || 0,     label: t("dashboard.security.kpi.file_viewed"),   tone: "zinc" },
        { key: "deletions",     icon: Trash2,      value: c.deletions || 0,       label: t("dashboard.security.kpi.deletions"),     tone: (c.deletions || 0) > 0 ? "red" : "zinc" },
        ...(denied > 0 ? [{ key: "reveal_denied", icon: Eye, value: denied, label: t("dashboard.security.kpi.reveal_denied"), tone: "red" }] : []),
    ];

    const TONE = {
        zinc:    "text-zinc-300",
        red:     "text-red-300",
        amber:   "text-amber-300",
    };

    return (
        <div
            data-testid="dashboard-security-card"
            className={`hl-card p-6 ${abnormal ? "border-red-500/30 ring-1 ring-red-500/15" : ""}`}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    {abnormal ? (
                        <ShieldAlert className="h-4 w-4 text-red-300" />
                    ) : (
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    )}
                    <div className="text-base font-medium text-white">{t("dashboard.security.title")}</div>
                </div>
                <Link
                    to="/audit"
                    data-testid="dashboard-security-view-log"
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                    {t("dashboard.security.view_log")} <ArrowUpRight className="h-3 w-3" />
                </Link>
            </div>

            {data === null ? (
                <div className="h-16 rounded-md bg-[var(--hl-elevated)]/40 animate-pulse" />
            ) : totalSignals === 0 ? (
                <div className="text-sm text-zinc-500 py-2 flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400/70" />
                    {t("dashboard.security.calm")}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {items.map(({ key, icon: Icon, value, label, tone }) => (
                        <div
                            key={key}
                            data-testid={`security-kpi-${key}`}
                            className="px-3 py-2.5 rounded-lg bg-[var(--hl-elevated)]/40 border border-[var(--hl-border-subtle)]"
                        >
                            <div className="flex items-center gap-1.5 hl-mono text-[10px] uppercase tracking-widest text-zinc-500">
                                <Icon className="h-3 w-3" /> {label}
                            </div>
                            <div className={`hl-mono text-xl mt-1 ${TONE[tone] || TONE.zinc}`}>{value}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
