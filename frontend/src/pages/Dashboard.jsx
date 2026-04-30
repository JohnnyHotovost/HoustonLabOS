import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { fmtMoney, fmtRelative } from "../lib/format";
import { StatusBadge, PriorityBadge } from "../components/houston/Badges";
import { Briefcase, CheckCircle2, AlertCircle, Wallet, ArrowUpRight, Calendar, Activity, Plus, Cpu, Users } from "lucide-react";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const ENTRY_DOT = {
    "Note": "bg-zinc-500", "Diagnosis": "bg-blue-400", "Repair": "bg-emerald-400",
    "Part Installed": "bg-cyan-400", "Test": "bg-indigo-400",
    "Customer Update": "bg-yellow-400", "Payment": "bg-emerald-300", "Problem": "bg-red-400",
};

function StatCard({ label, value, hint, icon: Icon, accent, testId }) {
    return (
        <div data-testid={testId} className="hl-stat-card relative overflow-hidden">
            <div className="flex items-start justify-between">
                <div>
                    <div className="kpi-label">{label}</div>
                    <div className="kpi-value mt-2.5">{value}</div>
                    {hint && <div className="text-xs text-zinc-500 mt-1.5">{hint}</div>}
                </div>
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accent || "bg-zinc-800/60 text-zinc-400"}`}>
                    <Icon className="h-4 w-4" />
                </div>
            </div>
        </div>
    );
}

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [finance, setFinance] = useState(null);

    useEffect(() => {
        (async () => {
            const [s, f] = await Promise.all([api.get("/dashboard/stats"), api.get("/dashboard/finance")]);
            setStats(s.data); setFinance(f.data);
        })();
    }, []);

    if (!stats || !finance) {
        return (
            <div className="grid grid-cols-4 gap-5">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
        );
    }

    return (
        <div className="space-y-8 hl-fade-up">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1.5">// Operational Overview</div>
                    <h1 className="text-3xl font-semibold tracking-tight text-white">Dashboard</h1>
                    <p className="text-sm text-zinc-500 mt-1">Live status across HoustonLab.</p>
                </div>
                <div className="flex gap-2">
                    <Button asChild variant="outline" className="border-[var(--hl-border)] bg-[var(--hl-card)] hover:bg-[var(--hl-elevated)]">
                        <Link to="/jobs/new" data-testid="quick-new-job"><Plus className="h-4 w-4 mr-2" /> New Job</Link>
                    </Button>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard testId="kpi-active" label="Active Jobs" value={stats.counts.active} hint={`${stats.counts.total} total`} icon={Briefcase} accent="bg-cyan-500/10 text-cyan-300" />
                <StatCard testId="kpi-completed" label="Completed" value={stats.counts.completed} hint="all-time" icon={CheckCircle2} accent="bg-emerald-500/10 text-emerald-300" />
                <StatCard testId="kpi-unpaid" label="Unpaid" value={stats.counts.unpaid} hint={`${fmtMoney(finance.unpaid_total)} outstanding`} icon={AlertCircle} accent="bg-red-500/10 text-red-300" />
                <StatCard testId="kpi-revenue" label="Monthly Revenue" value={fmtMoney(stats.revenue.monthly)} hint={`${fmtMoney(stats.revenue.total)} total`} icon={Wallet} accent="bg-emerald-500/10 text-emerald-300" />
            </div>

            {/* Chart + Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 hl-card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">// Last 6 months</div>
                            <div className="text-base font-medium text-white">Revenue</div>
                        </div>
                        <Link to="/finance" className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
                            Open finance <ArrowUpRight className="h-3 w-3" />
                        </Link>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={finance.monthly}>
                                <defs>
                                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                <XAxis dataKey="month" stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ background: "#121215", border: "1px solid #27272a", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "#a1a1aa" }} />
                                <Area type="monotone" dataKey="revenue" stroke="#34d399" strokeWidth={2} fill="url(#rev)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="hl-card p-6 flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                        <Activity className="h-4 w-4 text-emerald-400" />
                        <div className="text-base font-medium text-white">Recent Activity</div>
                    </div>
                    <div className="space-y-4 overflow-y-auto pr-1 max-h-[260px]">
                        {stats.recent_activity.length === 0 && <div className="text-sm text-zinc-500">No recent activity.</div>}
                        {stats.recent_activity.map((a) => (
                            <Link key={a.id} to={`/jobs/${a.job_id}`} className="block group">
                                <div className="flex gap-3">
                                    <div className={`h-2 w-2 rounded-full mt-1.5 ${ENTRY_DOT[a.type] || "bg-zinc-500"}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500">{a.type}</span>
                                            <span className="hl-mono text-[10px] text-emerald-400/70">{a.job_code}</span>
                                        </div>
                                        <div className="text-sm text-zinc-300 truncate group-hover:text-white">{a.text}</div>
                                        <div className="text-[10px] text-zinc-600 mt-0.5">{fmtRelative(a.created_at)}</div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Upcoming + Status breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="hl-card p-6 lg:col-span-2">
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar className="h-4 w-4 text-emerald-400" />
                        <div className="text-base font-medium text-white">Upcoming Deadlines</div>
                    </div>
                    {stats.upcoming.length === 0 ? (
                        <div className="text-sm text-zinc-500 py-6 text-center">No upcoming deadlines.</div>
                    ) : (
                        <div className="space-y-2">
                            {stats.upcoming.map((j) => (
                                <Link key={j.id} to={`/jobs/${j.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--hl-elevated)] transition-colors">
                                    <span className="hl-mono text-[10px] text-emerald-400/70 w-16">{j.code}</span>
                                    <span className="text-sm text-zinc-200 flex-1 truncate">{j.title}</span>
                                    <PriorityBadge value={j.priority} />
                                    <StatusBadge value={j.status} />
                                    <span className="hl-mono text-[10px] text-zinc-500 w-24 text-right">{fmtRelative(j.deadline)}</span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
                <div className="hl-card p-6">
                    <div className="text-base font-medium text-white mb-4">By Status</div>
                    <div className="space-y-2">
                        {Object.entries(stats.by_status).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between">
                                <StatusBadge value={k} />
                                <span className="hl-mono text-sm text-zinc-300">{v}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent clients & devices */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="hl-card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2"><Users className="h-4 w-4 text-emerald-400" /><div className="text-base font-medium text-white">Recent Clients</div></div>
                        <Link to="/clients" className="text-xs text-emerald-400 hover:text-emerald-300">All</Link>
                    </div>
                    <div className="space-y-2">
                        {stats.recent_clients.map((c) => (
                            <Link key={c.id} to={`/clients/${c.id}`} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--hl-elevated)] transition-colors">
                                <div className="h-7 w-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300 text-[11px] hl-mono">{c.full_name?.slice(0, 1) || "?"}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-zinc-200 truncate">{c.full_name}</div>
                                    <div className="text-[11px] text-zinc-500 truncate hl-mono">{c.phone || c.email || "—"}</div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
                <div className="hl-card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2"><Cpu className="h-4 w-4 text-emerald-400" /><div className="text-base font-medium text-white">Recent Devices</div></div>
                        <Link to="/devices" className="text-xs text-emerald-400 hover:text-emerald-300">All</Link>
                    </div>
                    <div className="space-y-2">
                        {stats.recent_devices.map((d) => (
                            <Link key={d.id} to={`/devices/${d.id}`} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--hl-elevated)] transition-colors">
                                <div className="h-7 w-7 rounded-md bg-zinc-800/60 border border-zinc-700 flex items-center justify-center text-zinc-300 text-[11px] hl-mono">{d.device_type?.slice(0, 1) || "?"}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-zinc-200 truncate">{d.name}</div>
                                    <div className="text-[11px] text-zinc-500 truncate hl-mono">{d.brand} {d.model} · {d.device_type}</div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
