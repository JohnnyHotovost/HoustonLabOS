import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import { useT } from "../i18n/I18nContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { fmtRelative, DEVICE_TYPES } from "../lib/format";
import { Plus, Search, Cpu } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { EmptyState } from "../components/houston/EmptyState";

export default function DevicesList() {
    const [devices, setDevices] = useState(null);
    const [q, setQ] = useState("");
    const [typeF, setTypeF] = useState("all");
    const navigate = useNavigate();
    const t = useT();

    useEffect(() => { (async () => { const { data } = await api.get("/devices"); setDevices(data); })(); }, []);

    const filtered = (devices || []).filter((d) => {
        if (typeF !== "all" && d.device_type !== typeF) return false;
        if (!q) return true;
        const s = q.toLowerCase();
        return d.name?.toLowerCase().includes(s) || d.brand?.toLowerCase().includes(s) || d.model?.toLowerCase().includes(s) || d.serial?.toLowerCase().includes(s);
    });

    return (
        <div className="space-y-6 hl-fade-up">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1.5">{t("devices.kicker")}</div>
                    <h1 className="text-3xl font-semibold tracking-tight text-white">{t("devices.title")}</h1>
                    <p className="text-sm text-zinc-500 mt-1">{t("devices.subtitle", { count: devices?.length || 0 })}</p>
                </div>
                <Button data-testid="devices-new-btn" onClick={() => navigate("/devices/new")} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950"><Plus className="h-4 w-4 mr-2" />{t("devices.new")}</Button>
            </div>

            <div className="hl-card p-4 flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input data-testid="devices-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("devices.search_placeholder")} className="pl-9 bg-[var(--hl-input)] border-[var(--hl-border)]" />
                </div>
                <Select value={typeF} onValueChange={setTypeF}>
                    <SelectTrigger data-testid="devices-filter-type" className="w-[200px] bg-[var(--hl-input)] border-[var(--hl-border)]"><SelectValue placeholder={t("devices.filter.all_types")} /></SelectTrigger>
                    <SelectContent><SelectItem value="all">{t("devices.filter.all_types")}</SelectItem>{DEVICE_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
            </div>

            {devices && filtered.length === 0 ? (
                <EmptyState icon={Cpu} title={t("devices.empty_title")} action={<Button onClick={() => navigate("/devices/new")} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950"><Plus className="h-4 w-4 mr-2" />{t("devices.new")}</Button>} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((d) => (
                        <Link key={d.id} to={`/devices/${d.id}`} data-testid={`device-card-${d.id}`} className="hl-card p-5 hover:border-emerald-500/30 group">
                            <div className="flex items-start justify-between">
                                <div className="min-w-0">
                                    <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500">{d.device_type}</div>
                                    <div className="text-base font-medium text-white mt-1 truncate group-hover:text-emerald-300">{d.name}</div>
                                    <div className="text-[12px] text-zinc-500 hl-mono mt-0.5 truncate">{d.brand} {d.model}</div>
                                </div>
                                <span className="text-[10px] hl-mono text-zinc-500 border border-[var(--hl-border)] rounded-full px-2 py-0.5">{t("devices.jobs_count", { n: d.job_count })}</span>
                            </div>
                            <div className="hl-divider my-4" />
                            <div className="flex items-center justify-between text-[11px] hl-mono text-zinc-500">
                                <span>{t("devices.sn", { serial: d.serial || "—" })}</span>
                                <span>{d.client_name ? `→ ${d.client_name}` : t("devices.no_owner")}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
