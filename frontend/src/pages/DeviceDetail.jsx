import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import { useT } from "../i18n/I18nContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { ChevronLeft, Save, Loader2, Trash2, Pencil } from "lucide-react";
import { DEVICE_TYPES, fmtRelative } from "../lib/format";
import { StatusBadge, PaymentBadge } from "../components/houston/Badges";
import { toast } from "sonner";

const PC_TYPES = new Set(["Desktop PC", "Gaming PC", "Laptop", "Server", "NAS"]);

export default function DeviceDetail({ mode = "view" }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const t = useT();
    const editing = mode === "edit" || mode === "new";
    const isNew = mode === "new";

    const [device, setDevice] = useState(null);
    const [clients, setClients] = useState([]);
    const [form, setForm] = useState({ name: "", device_type: "Desktop PC", brand: "", model: "", serial: "", client_id: "", notes: "", status: "Active", specs: {} });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            const c = await api.get("/clients"); setClients(c.data);
            if (!isNew) {
                const { data } = await api.get(`/devices/${id}`);
                setDevice(data);
                if (mode === "edit") setForm({
                    name: data.name, device_type: data.device_type, brand: data.brand || "",
                    model: data.model || "", serial: data.serial || "", client_id: data.client_id || "",
                    notes: data.notes || "", status: data.status || "Active", specs: data.specs || {},
                });
            }
        })();
    }, [id, isNew, mode]);

    const isPC = PC_TYPES.has(form.device_type);
    const setSpec = (k, v) => setForm({ ...form, specs: { ...form.specs, [k]: v } });

    const save = async () => {
        if (!form.name?.trim()) { toast.error(t("device.err.name_required")); return; }
        setSaving(true);
        try {
            const payload = { ...form, client_id: form.client_id || null };
            if (isNew) {
                const { data } = await api.post("/devices", payload);
                toast.success(t("device.created"));
                navigate(`/devices/${data.id}`);
            } else {
                await api.put(`/devices/${id}`, payload);
                toast.success(t("device.updated"));
                navigate(`/devices/${id}`);
            }
        } finally { setSaving(false); }
    };

    const del = async () => {
        if (!window.confirm(t("device.delete_confirm"))) return;
        await api.delete(`/devices/${id}`);
        toast.success(t("device.deleted"));
        navigate("/devices");
    };

    if (editing) {
        return (
            <div className="space-y-6 hl-fade-up max-w-3xl mx-auto w-full">
                <button onClick={() => navigate(-1)} className="text-sm text-zinc-500 hover:text-zinc-200 flex items-center gap-1.5"><ChevronLeft className="h-4 w-4" /> {t("common.back")}</button>
                <h1 className="text-3xl font-semibold tracking-tight text-white">{isNew ? t("device.new_title") : t("device.edit_title")}</h1>
                <div className="hl-card p-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Field label={t("device.field.name")}><Input data-testid="device-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                        <Field label={t("device.field.type")}>
                            <Select value={form.device_type} onValueChange={(v) => setForm({ ...form, device_type: v })}>
                                <SelectTrigger data-testid="device-type" className="bg-[var(--hl-input)] border-[var(--hl-border)]"><SelectValue /></SelectTrigger>
                                <SelectContent>{DEVICE_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                        </Field>
                        <Field label={t("device.field.brand")}><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                        <Field label={t("device.field.model")}><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                        <Field label={t("device.field.serial")}><Input data-testid="device-serial" value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)] hl-mono" /></Field>
                        <Field label={t("device.field.owner")}>
                            <Select value={form.client_id || "none"} onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v })}>
                                <SelectTrigger className="bg-[var(--hl-input)] border-[var(--hl-border)]"><SelectValue placeholder={t("device.no_owner")} /></SelectTrigger>
                                <SelectContent><SelectItem value="none">{t("device.no_owner")}</SelectItem>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                            </Select>
                        </Field>
                    </div>
                    <Field label={t("device.field.notes")}><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)] min-h-[80px]" /></Field>

                    {isPC && (
                        <div className="pt-5 border-t border-[var(--hl-border-subtle)]">
                            <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">{t("device.specs_heading")}</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {[["cpu", "CPU"], ["gpu", "GPU"], ["motherboard", "Motherboard"], ["ram", "RAM"], ["storage", "Storage"], ["psu", "PSU"], ["cooling", "Cooling"], ["case", "Case"], ["os", "OS"], ["bios_version", "BIOS"], ["benchmark", "Benchmark"], ["temps", "Temperatures"]].map(([k, l]) => (
                                    <Field key={k} label={l}><Input value={form.specs[k] || ""} onChange={(e) => setSpec(k, e.target.value)} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => navigate(-1)}>{t("common.cancel")}</Button>
                        <Button data-testid="device-save-btn" onClick={save} disabled={saving} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t("common.save")}</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (!device) return <div className="text-zinc-500 text-sm">{t("common.loading")}</div>;

    return (
        <div className="space-y-6 hl-fade-up">
            <button onClick={() => navigate(-1)} className="text-sm text-zinc-500 hover:text-zinc-200 flex items-center gap-1.5"><ChevronLeft className="h-4 w-4" /> Back</button>
            <div className="hl-card p-6">
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div>
                        <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1">// {device.device_type}</div>
                        <h1 data-testid="device-detail-name" className="text-3xl font-semibold tracking-tight text-white">{device.name}</h1>
                        <div className="text-sm text-zinc-500 mt-0.5 hl-mono">{device.brand} {device.model}</div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="border-[var(--hl-border)] bg-[var(--hl-card)]" onClick={() => navigate(`/devices/${device.id}/edit`)}><Pencil className="h-4 w-4 mr-2" />Edit</Button>
                        <Button variant="outline" className="border-red-500/20 text-red-300 hover:bg-red-500/10" onClick={del}><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-6 pt-5 border-t border-[var(--hl-border-subtle)]">
                    <Meta label="Serial" value={<span className="hl-mono text-xs">{device.serial || "—"}</span>} />
                    <Meta label="Owner" value={device.client ? <Link to={`/clients/${device.client.id}`} className="hover:text-emerald-300">{device.client.full_name}</Link> : "—"} />
                    <Meta label="Status" value={device.status || "Active"} />
                    <Meta label="Jobs" value={device.jobs?.length || 0} />
                </div>
            </div>

            {device.specs && Object.keys(device.specs).length > 0 && (
                <div className="hl-card p-6">
                    <div className="text-base font-medium text-white mb-4">Hardware Specs</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {Object.entries(device.specs).map(([k, v]) => (
                            <div key={k} className="flex justify-between border-b border-[var(--hl-border-subtle)] py-1.5">
                                <span className="text-zinc-500 capitalize">{k.replace(/_/g, " ")}</span>
                                <span className="hl-mono text-xs text-zinc-200">{String(v)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="hl-card p-6">
                <div className="text-base font-medium text-white mb-4">Service history</div>
                {device.jobs?.length === 0 && <div className="text-sm text-zinc-500">No jobs yet for this device.</div>}
                {device.jobs?.map((j) => (
                    <Link key={j.id} to={`/jobs/${j.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--hl-elevated)]">
                        <span className="hl-mono text-[10px] text-emerald-400/80 w-16">{j.code}</span>
                        <span className="text-sm text-zinc-200 flex-1 truncate">{j.title}</span>
                        <StatusBadge value={j.status} />
                        <PaymentBadge value={j.finance?.payment_status} />
                        <span className="hl-mono text-[10px] text-zinc-500 w-24 text-right">{fmtRelative(j.created_at)}</span>
                    </Link>
                ))}
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
