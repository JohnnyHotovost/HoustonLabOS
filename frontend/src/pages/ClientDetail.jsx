import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import { useT } from "../i18n/I18nContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { ChevronLeft, Save, Loader2, Trash2, Pencil } from "lucide-react";
import { fmtMoney, fmtRelative } from "../lib/format";
import { StatusBadge, PaymentBadge } from "../components/houston/Badges";
import { toast } from "sonner";

export default function ClientDetail({ mode = "view" }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const t = useT();
    const editing = mode === "edit" || mode === "new";
    const isNew = mode === "new";
    const [client, setClient] = useState(null);
    const [form, setForm] = useState({ full_name: "", phone: "", email: "", address: "", notes: "", trust_notes: "" });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isNew) return;
        (async () => {
            const { data } = await api.get(`/clients/${id}`);
            setClient(data);
            if (mode === "edit") setForm({
                full_name: data.full_name || "", phone: data.phone || "", email: data.email || "",
                address: data.address || "", notes: data.notes || "", trust_notes: data.trust_notes || "",
            });
        })();
    }, [id, isNew, mode]);

    const save = async () => {
        if (!form.full_name?.trim()) { toast.error(t("client.err.name_required")); return; }
        setSaving(true);
        try {
            if (isNew) {
                const { data } = await api.post("/clients", form);
                toast.success(t("client.created"));
                navigate(`/clients/${data.id}`);
            } else {
                await api.put(`/clients/${id}`, form);
                toast.success(t("client.updated"));
                navigate(`/clients/${id}`);
            }
        } finally { setSaving(false); }
    };

    const del = async () => {
        if (!window.confirm(t("client.delete_confirm"))) return;
        await api.delete(`/clients/${id}`);
        toast.success(t("client.deleted"));
        navigate("/clients");
    };

    if (editing) {
        return (
            <div className="space-y-6 hl-fade-up max-w-2xl mx-auto w-full">
                <button onClick={() => navigate(-1)} className="text-sm text-zinc-500 hover:text-zinc-200 flex items-center gap-1.5"><ChevronLeft className="h-4 w-4" /> {t("common.back")}</button>
                <h1 className="text-3xl font-semibold tracking-tight text-white">{isNew ? t("client.new_title") : t("client.edit_title")}</h1>
                <div className="hl-card p-6 space-y-5">
                    <Field label={t("client.field.name")}><Input data-testid="client-full-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Field label={t("client.field.phone")}><Input data-testid="client-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                        <Field label={t("client.field.email")}><Input data-testid="client-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                    </div>
                    <Field label={t("client.field.address")}><Input data-testid="client-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                    <Field label={t("client.field.notes")}><Textarea data-testid="client-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)] min-h-[80px]" /></Field>
                    <Field label={t("client.field.trust")}><Textarea data-testid="client-trust" value={form.trust_notes} onChange={(e) => setForm({ ...form, trust_notes: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)] min-h-[60px]" /></Field>
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => navigate(-1)}>{t("common.cancel")}</Button>
                        <Button data-testid="client-save-btn" onClick={save} disabled={saving} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t("common.save")}</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (!client) return <div className="text-zinc-500 text-sm">{t("common.loading")}</div>;

    return (
        <div className="space-y-6 hl-fade-up">
            <button onClick={() => navigate(-1)} className="text-sm text-zinc-500 hover:text-zinc-200 flex items-center gap-1.5"><ChevronLeft className="h-4 w-4" /> {t("common.back")}</button>
            <div className="hl-card p-6">
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300 text-xl hl-mono">{client.full_name?.slice(0, 1)}</div>
                        <div>
                            <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1">{t("client.kicker")}</div>
                            <h1 data-testid="client-detail-name" className="text-3xl font-semibold tracking-tight text-white">{client.full_name}</h1>
                            <div className="text-sm text-zinc-500 mt-0.5 hl-mono">{client.phone || client.email || "—"}</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="border-[var(--hl-border)] bg-[var(--hl-card)]" onClick={() => navigate(`/clients/${client.id}/edit`)}><Pencil className="h-4 w-4 mr-2" />{t("common.edit")}</Button>
                        <Button variant="outline" className="border-red-500/20 text-red-300 hover:bg-red-500/10" onClick={del}><Trash2 className="h-4 w-4 mr-2" />{t("common.delete")}</Button>
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-6 pt-5 border-t border-[var(--hl-border-subtle)]">
                    <Meta label={t("client.meta.email")} value={<span className="hl-mono text-xs">{client.email || "—"}</span>} />
                    <Meta label={t("client.meta.address")} value={client.address || "—"} />
                    <Meta label={t("client.meta.jobs")} value={client.jobs?.length || 0} />
                    <Meta label={t("client.meta.total_spent")} value={<span className="hl-mono">{fmtMoney(client.total_spent || 0)}</span>} />
                </div>
                {client.notes && <div className="mt-6 pt-5 border-t border-[var(--hl-border-subtle)] text-sm text-zinc-300 whitespace-pre-wrap">{client.notes}</div>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="hl-card p-6">
                    <div className="text-base font-medium text-white mb-4">{t("client.devices")}</div>
                    {client.devices?.length === 0 && <div className="text-sm text-zinc-500">{t("client.no_devices")}</div>}
                    {client.devices?.map((d) => (
                        <Link key={d.id} to={`/devices/${d.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--hl-elevated)]">
                            <div className="h-7 w-7 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center hl-mono text-[10px] text-zinc-300">{d.device_type?.slice(0, 1)}</div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-zinc-200 truncate">{d.name}</div>
                                <div className="text-[11px] text-zinc-500 hl-mono">{d.brand} {d.model} · {d.device_type}</div>
                            </div>
                        </Link>
                    ))}
                </div>
                <div className="hl-card p-6">
                    <div className="text-base font-medium text-white mb-4">{t("client.jobs_history")}</div>
                    {client.jobs?.length === 0 && <div className="text-sm text-zinc-500">{t("client.no_jobs")}</div>}
                    {client.jobs?.map((j) => (
                        <Link key={j.id} to={`/jobs/${j.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--hl-elevated)]">
                            <span className="hl-mono text-[10px] text-emerald-400/80 w-16">{j.code}</span>
                            <span className="text-sm text-zinc-200 flex-1 truncate">{j.title}</span>
                            <StatusBadge value={j.status} />
                            <PaymentBadge value={j.finance?.payment_status} />
                            <span className="text-[10px] text-zinc-500 hl-mono w-20 text-right">{fmtRelative(j.created_at)}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div className="space-y-2">
            <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">{label}</Label>
            {children}
        </div>
    );
}
function Meta({ label, value }) {
    return (
        <div>
            <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{label}</div>
            <div className="text-sm text-zinc-200">{value}</div>
        </div>
    );
}
