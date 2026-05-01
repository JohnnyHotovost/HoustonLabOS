import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { fmtMoney } from "../lib/format";
import { useT } from "../i18n/I18nContext";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { TrendingUp, AlertTriangle, Wallet, BarChart2 } from "lucide-react";
import { PaymentBadge } from "../components/houston/Badges";
import RangePicker, { rangeParams, formatBucketLabel } from "../components/houston/RangePicker";

function StatCard({ label, value, hint, icon: Icon, accent }) {
    return (
        <div className="hl-stat-card">
            <div className="flex items-start justify-between">
                <div>
                    <div className="kpi-label">{label}</div>
                    <div className="kpi-value mt-2.5">{value}</div>
                    {hint && <div className="text-xs text-zinc-500 mt-1.5">{hint}</div>}
                </div>
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accent}`}>
                    <Icon className="h-4 w-4" />
                </div>
            </div>
        </div>
    );
}

export default function FinancePage() {
    const [data, setData] = useState(null);
    const [range, setRange] = useState({ key: "month" }); // Finance default: This month
    const t = useT();

    useEffect(() => {
        let cancel = false;
        (async () => {
            const r = await api.get("/dashboard/finance", { params: rangeParams(range) });
            if (!cancel) setData(r.data);
        })();
        return () => { cancel = true; };
    }, [range]);

    if (!data) return <div className="text-zinc-500 text-sm">{t("common.loading")}</div>;

    const series = (data.series || []).map((p) => ({ ...p, label: formatBucketLabel(p.bucket) }));

    return (
        <div className="space-y-7 hl-fade-up">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1.5">{t("finance.kicker")}</div>
                    <h1 className="text-3xl font-semibold tracking-tight text-white">{t("finance.title")}</h1>
                    <p className="text-sm text-zinc-500 mt-1">{t("finance.subtitle")}</p>
                </div>
                <RangePicker value={range} onChange={setRange} testId="finance-range" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard label={t("finance.kpi.total_revenue")} value={fmtMoney(data.total_revenue)} hint={t("finance.kpi.paid_count", { n: data.paid_count })} icon={Wallet} accent="bg-emerald-500/10 text-emerald-300" />
                <StatCard label={t("finance.kpi.total_profit")} value={fmtMoney(data.total_profit)} hint={t("finance.kpi.profit_hint")} icon={TrendingUp} accent="bg-emerald-500/10 text-emerald-300" />
                <StatCard label={t("finance.kpi.outstanding")} value={fmtMoney(data.unpaid_total)} hint={t("finance.kpi.unpaid_count", { n: data.unpaid_count })} icon={AlertTriangle} accent="bg-red-500/10 text-red-300" />
                <StatCard label={t("finance.kpi.avg")} value={fmtMoney(Math.round(data.avg_job_value))} hint={t("finance.kpi.avg_hint")} icon={BarChart2} accent="bg-cyan-500/10 text-cyan-300" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 hl-card p-6">
                    <div className="text-base font-medium text-white mb-4">{t("finance.monthly_title")}</div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={series}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis dataKey="label" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ background: "#121215", border: "1px solid #27272a", borderRadius: 10, fontSize: 12 }}
                                    cursor={{ fill: "rgba(52,211,153,0.06)" }}
                                    isAnimationActive={false}
                                    content={(p) => (p?.active && p?.payload?.length ? (
                                        <div style={{ background: "#121215", border: "1px solid #27272a", borderRadius: 10, fontSize: 12, padding: "6px 10px" }}>
                                            <div style={{ color: "#a1a1aa", marginBottom: 2 }}>{p.label}</div>
                                            <div style={{ color: "#34d399" }}>{p.payload[0].value?.toLocaleString?.("cs-CZ") ?? p.payload[0].value} CZK</div>
                                        </div>
                                    ) : null)}
                                />
                                <Bar dataKey="revenue" name={t("finance.kpi.total_revenue")} fill="#34d399" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="profit" name={t("finance.kpi.total_profit")} fill="#22d3ee" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="hl-card p-6">
                    <div className="text-base font-medium text-white mb-4">{t("finance.by_category_title")}</div>
                    <div className="space-y-4">
                        {data.by_category.sort((a, b) => b.revenue - a.revenue).map((c) => {
                            const max = Math.max(...data.by_category.map((x) => x.revenue || 0), 1);
                            const pct = Math.round(((c.revenue || 0) / max) * 100);
                            const profitPct = c.revenue > 0 ? Math.round((c.profit / c.revenue) * 100) : 0;
                            return (
                                <div key={c.category}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-zinc-300">{c.category}</span>
                                        <span className="hl-mono text-zinc-400">{fmtMoney(c.revenue)}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                                    </div>
                                    <div className="flex justify-between text-[10px] hl-mono mt-1 text-zinc-500">
                                        <span>{t("finance.by_category_profit")}: <span className="text-emerald-300">{fmtMoney(c.profit)}</span></span>
                                        <span>{profitPct}%</span>
                                    </div>
                                </div>
                            );
                        })}
                        {data.by_category.length === 0 && (
                            <div className="text-sm text-zinc-500">{t("dashboard.activity.empty")}</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="hl-card p-6">
                    <div className="text-base font-medium text-white mb-4">{t("finance.outstanding_title")}</div>
                    {data.unpaid_jobs.length === 0 && <div className="text-sm text-zinc-500">{t("finance.all_paid")}</div>}
                    {data.unpaid_jobs.map((j) => (
                        <Link key={j.id} to={`/jobs/${j.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--hl-elevated)]">
                            <span className="hl-mono text-[10px] text-emerald-400/80 w-16">{j.code}</span>
                            <span className="text-sm text-zinc-200 flex-1 truncate">{j.title}</span>
                            <PaymentBadge value={j.status} />
                            <span className="hl-mono text-sm text-red-300 w-24 text-right">{fmtMoney(j.amount)}</span>
                        </Link>
                    ))}
                </div>
                <div className="hl-card p-6">
                    <div className="text-base font-medium text-white mb-4">{t("finance.recent_payments")}</div>
                    {data.paid_jobs.length === 0 && <div className="text-sm text-zinc-500">{t("finance.no_payments")}</div>}
                    {data.paid_jobs.map((j) => (
                        <Link key={j.id} to={`/jobs/${j.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--hl-elevated)]">
                            <span className="hl-mono text-[10px] text-emerald-400/80 w-16">{j.code}</span>
                            <span className="text-sm text-zinc-200 flex-1 truncate">{j.title}</span>
                            <span className="hl-mono text-sm text-emerald-300 w-24 text-right">{fmtMoney(j.amount)}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
