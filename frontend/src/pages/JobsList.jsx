import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { fmtRelative, fmtMoney, STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS, JOB_CATEGORIES } from "../lib/format";
import { useT } from "../i18n/I18nContext";
import { StatusBadge, PriorityBadge, PaymentBadge } from "../components/houston/Badges";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Plus, Search, Filter, Briefcase } from "lucide-react";
import { EmptyState } from "../components/houston/EmptyState";

export default function JobsList() {
    const [jobs, setJobs] = useState(null);
    const [search, setSearch] = useState("");
    const [statusF, setStatusF] = useState("all");
    const [categoryF, setCategoryF] = useState("all");
    const [paymentF, setPaymentF] = useState("all");
    const [sort, setSort] = useState("newest");
    const navigate = useNavigate();
    const t = useT();

    useEffect(() => { (async () => { const { data } = await api.get("/jobs"); setJobs(data); })(); }, []);

    const filtered = useMemo(() => {
        if (!jobs) return null;
        let out = jobs.filter((j) => {
            if (statusF !== "all" && j.status !== statusF) return false;
            if (categoryF !== "all" && j.category !== categoryF) return false;
            if (paymentF !== "all" && j.finance?.payment_status !== paymentF) return false;
            if (search) {
                const s = search.toLowerCase();
                if (!(j.title?.toLowerCase().includes(s) || j.code?.toLowerCase().includes(s) || j.client_name?.toLowerCase().includes(s) || j.tags?.some(t => t.toLowerCase().includes(s)))) return false;
            }
            return true;
        });
        switch (sort) {
            case "deadline": out.sort((a, b) => (a.deadline || "").localeCompare(b.deadline || "")); break;
            case "priority": {
                const order = { Urgent: 0, High: 1, Normal: 2, Low: 3 };
                out.sort((a, b) => order[a.priority] - order[b.priority]); break;
            }
            case "price": out.sort((a, b) => (b.finance?.labor_price + b.finance?.parts_price) - (a.finance?.labor_price + a.finance?.parts_price)); break;
            case "status": out.sort((a, b) => a.status.localeCompare(b.status)); break;
            default: out.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        }
        return out;
    }, [jobs, search, statusF, categoryF, paymentF, sort]);

    return (
        <div className="space-y-6 hl-fade-up">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1.5">{t("jobs.kicker")}</div>
                    <h1 className="text-3xl font-semibold tracking-tight text-white">{t("jobs.title")}</h1>
                    <p className="text-sm text-zinc-500 mt-1">{t("jobs.subtitle", { count: jobs?.length || 0 })}</p>
                </div>
                <Button data-testid="jobs-new-btn" className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950" onClick={() => navigate("/jobs/new")}>
                    <Plus className="h-4 w-4 mr-2" /> {t("jobs.new")}
                </Button>
            </div>

            <div className="hl-card p-4 flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input data-testid="jobs-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("jobs.search_placeholder")} className="pl-9 bg-[var(--hl-input)] border-[var(--hl-border)]" />
                </div>
                <Filter className="h-4 w-4 text-zinc-500" />
                <Select value={statusF} onValueChange={setStatusF}>
                    <SelectTrigger data-testid="jobs-filter-status" className="w-[180px] bg-[var(--hl-input)] border-[var(--hl-border)]"><SelectValue placeholder={t("jobs.col.status")} /></SelectTrigger>
                    <SelectContent><SelectItem value="all">{t("jobs.filter.all_status")}</SelectItem>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={categoryF} onValueChange={setCategoryF}>
                    <SelectTrigger data-testid="jobs-filter-category" className="w-[180px] bg-[var(--hl-input)] border-[var(--hl-border)]"><SelectValue placeholder={t("jobs.col.category")} /></SelectTrigger>
                    <SelectContent><SelectItem value="all">{t("jobs.filter.all_category")}</SelectItem>{JOB_CATEGORIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={paymentF} onValueChange={setPaymentF}>
                    <SelectTrigger data-testid="jobs-filter-payment" className="w-[160px] bg-[var(--hl-input)] border-[var(--hl-border)]"><SelectValue placeholder={t("jobs.col.payment")} /></SelectTrigger>
                    <SelectContent><SelectItem value="all">{t("jobs.filter.any_payment")}</SelectItem>{PAYMENT_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={sort} onValueChange={setSort}>
                    <SelectTrigger className="w-[140px] bg-[var(--hl-input)] border-[var(--hl-border)]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="newest">{t("jobs.sort.newest")}</SelectItem>
                        <SelectItem value="deadline">{t("jobs.sort.deadline")}</SelectItem>
                        <SelectItem value="priority">{t("jobs.sort.priority")}</SelectItem>
                        <SelectItem value="price">{t("jobs.sort.price")}</SelectItem>
                        <SelectItem value="status">{t("jobs.sort.status")}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="hl-card overflow-hidden">
                {!filtered ? (
                    <div className="p-12 text-center text-sm text-zinc-500">{t("common.loading")}</div>
                ) : filtered.length === 0 ? (
                    <EmptyState icon={Briefcase} title={t("jobs.empty_title")} description={t("jobs.empty_desc")} action={<Button onClick={() => navigate("/jobs/new")} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950"><Plus className="h-4 w-4 mr-2" />{t("jobs.new")}</Button>} />
                ) : (
                    <div className="overflow-x-auto">
                        <table data-testid="jobs-table" className="min-w-full text-sm">
                            <thead className="border-b border-[var(--hl-border-subtle)]">
                                <tr className="text-left">
                                    <th className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500 font-medium">{t("jobs.col.code")}</th>
                                    <th className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500 font-medium">{t("jobs.col.title")}</th>
                                    <th className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500 font-medium">{t("jobs.col.category")}</th>
                                    <th className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500 font-medium">{t("jobs.col.status")}</th>
                                    <th className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500 font-medium">{t("jobs.col.priority")}</th>
                                    <th className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500 font-medium">{t("jobs.col.payment")}</th>
                                    <th className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500 font-medium">{t("jobs.col.total")}</th>
                                    <th className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500 font-medium">{t("jobs.col.updated")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((j) => {
                                    const total = (j.finance?.labor_price || 0) + (j.finance?.parts_price || 0) - (j.finance?.discount || 0);
                                    return (
                                        <tr key={j.id} data-testid={`job-row-${j.code}`} className="border-b border-[var(--hl-border-subtle)] hover:bg-[var(--hl-card-hover)] cursor-pointer transition-colors" onClick={() => navigate(`/jobs/${j.id}`)}>
                                            <td className="px-5 py-3.5 hl-mono text-[12px] text-emerald-400/80">{j.code}</td>
                                            <td className="px-5 py-3.5">
                                                <div className="text-zinc-100 font-medium truncate max-w-[320px]">{j.title}</div>
                                                <div className="text-[11px] text-zinc-500 truncate">{j.client_name || t("jobs.no_client")}</div>
                                            </td>
                                            <td className="px-5 py-3.5 text-zinc-400 text-xs">{j.category}</td>
                                            <td className="px-5 py-3.5"><StatusBadge value={j.status} /></td>
                                            <td className="px-5 py-3.5"><PriorityBadge value={j.priority} /></td>
                                            <td className="px-5 py-3.5"><PaymentBadge value={j.finance?.payment_status} /></td>
                                            <td className="px-5 py-3.5 hl-mono text-xs text-zinc-300">{fmtMoney(total, j.finance?.currency)}</td>
                                            <td className="px-5 py-3.5 hl-mono text-[11px] text-zinc-500">{fmtRelative(j.updated_at || j.created_at)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
