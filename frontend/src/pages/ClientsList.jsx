import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { fmtMoney, fmtRelative } from "../lib/format";
import { Plus, Search, Users } from "lucide-react";
import { EmptyState } from "../components/houston/EmptyState";

export default function ClientsList() {
    const [clients, setClients] = useState(null);
    const [q, setQ] = useState("");
    const navigate = useNavigate();
    useEffect(() => { (async () => { const { data } = await api.get("/clients"); setClients(data); })(); }, []);

    const filtered = (clients || []).filter((c) => {
        if (!q) return true;
        const s = q.toLowerCase();
        return c.full_name?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s) || c.phone?.toLowerCase().includes(s);
    });

    return (
        <div className="space-y-6 hl-fade-up">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1.5">// People</div>
                    <h1 className="text-3xl font-semibold tracking-tight text-white">Clients</h1>
                    <p className="text-sm text-zinc-500 mt-1">{clients?.length || 0} customers in the database.</p>
                </div>
                <Button data-testid="clients-new-btn" onClick={() => navigate("/clients/new")} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950"><Plus className="h-4 w-4 mr-2" />New Client</Button>
            </div>

            <div className="hl-card p-4">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input data-testid="clients-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone…" className="pl-9 bg-[var(--hl-input)] border-[var(--hl-border)]" />
                </div>
            </div>

            {clients && filtered.length === 0 ? (
                <EmptyState icon={Users} title="No clients" action={<Button onClick={() => navigate("/clients/new")} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950"><Plus className="h-4 w-4 mr-2" />New Client</Button>} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((c) => (
                        <Link to={`/clients/${c.id}`} key={c.id} data-testid={`client-card-${c.id}`} className="hl-card p-5 hover:border-emerald-500/30 group">
                            <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300 hl-mono">{c.full_name?.slice(0, 1) || "?"}</div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-base font-medium text-white truncate group-hover:text-emerald-300">{c.full_name}</div>
                                    <div className="text-[12px] text-zinc-500 hl-mono truncate">{c.phone || c.email || "—"}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-5">
                                <div><div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500">Jobs</div><div className="text-sm text-zinc-200 mt-1">{c.job_count}</div></div>
                                <div><div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500">Spent</div><div className="text-sm hl-mono text-zinc-200 mt-1">{fmtMoney(c.total_spent || 0)}</div></div>
                                <div><div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500">Last</div><div className="text-[11px] text-zinc-400 mt-1">{c.last_job_date ? fmtRelative(c.last_job_date) : "—"}</div></div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
