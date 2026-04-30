import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { ChevronLeft, FileCode2, Save, Loader2, Cpu, Network, Server, Apple, Wrench, Sparkles, Globe, Gamepad2, Laptop, Lightbulb, MessageSquare, Box } from "lucide-react";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "../lib/format";
import DynamicFields from "../components/houston/DynamicFields";
import { toast } from "sonner";

const CATEGORY_ICON = {
    "Custom PC Build": Cpu,
    "PC Repair": Wrench,
    "PC Cleaning": Sparkles,
    "Laptop Service": Laptop,
    "Console Service": Gamepad2,
    "Apple/iPhone": Apple,
    "Networking": Network,
    "UniFi Setup": Network,
    "NAS/Server": Server,
    "Minecraft Server Hosting": Box,
    "Game Server Hosting": Box,
    "Website/Hosting": Globe,
    "Consultation": Lightbulb,
    "Other": MessageSquare,
};

export default function JobNewEdit() {
    const { id } = useParams();
    const editing = !!id;
    const navigate = useNavigate();

    const [templates, setTemplates] = useState([]);
    const [clients, setClients] = useState([]);
    const [devices, setDevices] = useState([]);
    const [tplId, setTplId] = useState(null);
    const [form, setForm] = useState({
        title: "", category: "", status: "New", priority: "Normal",
        client_id: "", device_id: "", description: "", internal_notes: "",
        customer_summary: "", tags: "", deadline: "",
        custom_fields: {},
        finance: { labor_price: 0, parts_price: 0, discount: 0, currency: "CZK", payment_status: "Unpaid", payment_method: "", payment_date: "", payment_note: "", paid_amount: 0 },
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            const [t, c, d] = await Promise.all([api.get("/templates"), api.get("/clients"), api.get("/devices")]);
            setTemplates(t.data); setClients(c.data); setDevices(d.data);
            if (editing) {
                const { data: job } = await api.get(`/jobs/${id}`);
                setTplId(job.template_id);
                setForm({
                    title: job.title, category: job.category, status: job.status, priority: job.priority,
                    client_id: job.client_id || "", device_id: job.device_id || "",
                    description: job.description || "", internal_notes: job.internal_notes || "",
                    customer_summary: job.customer_summary || "", tags: (job.tags || []).join(", "),
                    deadline: job.deadline?.slice(0, 10) || "", custom_fields: job.custom_fields || {},
                    finance: { ...job.finance },
                });
            }
        })();
    }, [editing, id]);

    const selectedTpl = useMemo(() => templates.find((t) => t.id === tplId), [templates, tplId]);

    const pickTemplate = (t) => {
        setTplId(t.id);
        setForm((prev) => ({
            ...prev,
            category: t.category,
            title: prev.title || t.name,
        }));
    };

    const filteredDevices = useMemo(() => {
        if (!form.client_id) return devices;
        return devices.filter((d) => !d.client_id || d.client_id === form.client_id);
    }, [devices, form.client_id]);

    const onSave = async () => {
        if (!form.title?.trim()) { toast.error("Title required"); return; }
        if (!form.category) { toast.error("Pick a template first"); return; }
        setSaving(true);
        try {
            const payload = {
                ...form,
                template_id: tplId || null,
                client_id: form.client_id || null,
                device_id: form.device_id || null,
                tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
                deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
                received_date: editing ? undefined : new Date().toISOString(),
            };
            const { data } = editing
                ? await api.put(`/jobs/${id}`, payload)
                : await api.post(`/jobs`, payload);
            toast.success(editing ? "Job updated" : "Job created");
            navigate(`/jobs/${data.id}`);
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Save failed");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-7 hl-fade-up">
            <button onClick={() => navigate(-1)} data-testid="job-back-btn" className="text-sm text-zinc-500 hover:text-zinc-200 flex items-center gap-1.5"><ChevronLeft className="h-4 w-4" /> Back</button>

            <div>
                <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1.5">// {editing ? "Edit" : "New"} job</div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">{editing ? "Edit Job" : "Create Job"}</h1>
                <p className="text-sm text-zinc-500 mt-1">Pick a template — the form will adapt to the work type.</p>
            </div>

            {!editing && !tplId && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <FileCode2 className="h-4 w-4 text-emerald-400" />
                        <span>Choose a job template</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {templates.map((t) => {
                            const Icon = CATEGORY_ICON[t.category] || Box;
                            return (
                                <button key={t.id} data-testid={`template-card-${t.name.toLowerCase().replace(/\s+/g, "-").replace(/\//g, "-")}`}
                                    onClick={() => pickTemplate(t)}
                                    className="hl-card p-5 text-left hover:border-emerald-500/40 hover:bg-[var(--hl-card-hover)] transition-all group">
                                    <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3 group-hover:bg-emerald-500/20 transition-colors">
                                        <Icon className="h-4 w-4 text-emerald-400" />
                                    </div>
                                    <div className="text-sm font-medium text-zinc-100">{t.name}</div>
                                    <div className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{t.description}</div>
                                    <div className="mt-3 flex items-center gap-2">
                                        <span className="hl-mono text-[10px] text-zinc-500">{t.fields.length} fields</span>
                                        <span className="text-zinc-700">·</span>
                                        <span className="hl-mono text-[10px] text-zinc-500">{t.checklist.length} checklist</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {(tplId || editing) && (
                <div className="space-y-7">
                    {selectedTpl && (
                        <div className="hl-card p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                    <FileCode2 className="h-4 w-4 text-emerald-400" />
                                </div>
                                <div>
                                    <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500">Template</div>
                                    <div className="text-sm font-medium text-white">{selectedTpl.name}</div>
                                </div>
                            </div>
                            {!editing && <Button variant="ghost" size="sm" onClick={() => setTplId(null)} data-testid="change-template-btn">Change</Button>}
                        </div>
                    )}

                    {/* Base fields */}
                    <div className="hl-card p-6 space-y-5">
                        <div className="text-base font-medium text-white">Job basics</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="md:col-span-2 space-y-2">
                                <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Title</Label>
                                <Input data-testid="job-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)] h-11" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Status</Label>
                                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                                    <SelectTrigger data-testid="job-status-select" className="bg-[var(--hl-input)] border-[var(--hl-border)]"><SelectValue /></SelectTrigger>
                                    <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Priority</Label>
                                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                                    <SelectTrigger data-testid="job-priority-select" className="bg-[var(--hl-input)] border-[var(--hl-border)]"><SelectValue /></SelectTrigger>
                                    <SelectContent>{PRIORITY_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Client</Label>
                                <Select value={form.client_id || "none"} onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v, device_id: "" })}>
                                    <SelectTrigger data-testid="job-client-select" className="bg-[var(--hl-input)] border-[var(--hl-border)]"><SelectValue placeholder="No client" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No client</SelectItem>
                                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Device</Label>
                                <Select value={form.device_id || "none"} onValueChange={(v) => setForm({ ...form, device_id: v === "none" ? "" : v })}>
                                    <SelectTrigger data-testid="job-device-select" className="bg-[var(--hl-input)] border-[var(--hl-border)]"><SelectValue placeholder="No device" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No device</SelectItem>
                                        {filteredDevices.map(d => <SelectItem key={d.id} value={d.id}>{d.name} · {d.brand} {d.model}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Deadline</Label>
                                <Input data-testid="job-deadline-input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Tags</Label>
                                <Input data-testid="job-tags-input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="comma, separated" className="bg-[var(--hl-input)] border-[var(--hl-border)]" />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Description</Label>
                                <Textarea data-testid="job-description-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)] min-h-[80px]" />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Internal notes</Label>
                                <Textarea data-testid="job-internal-notes" value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)] min-h-[70px]" />
                            </div>
                        </div>
                    </div>

                    {/* Template-driven fields */}
                    <div className="hl-card p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="text-base font-medium text-white">Template fields</div>
                            <span className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500">{selectedTpl?.fields?.length || 0} fields</span>
                        </div>
                        <DynamicFields fields={selectedTpl?.fields || []} values={form.custom_fields} onChange={(v) => setForm({ ...form, custom_fields: v })} />
                    </div>

                    {/* Finance */}
                    <div className="hl-card p-6 space-y-5">
                        <div className="text-base font-medium text-white">Finance</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="space-y-2">
                                <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Labor (CZK)</Label>
                                <Input data-testid="finance-labor" type="number" value={form.finance.labor_price} onChange={(e) => setForm({ ...form, finance: { ...form.finance, labor_price: Number(e.target.value || 0) } })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Parts (CZK)</Label>
                                <Input data-testid="finance-parts" type="number" value={form.finance.parts_price} onChange={(e) => setForm({ ...form, finance: { ...form.finance, parts_price: Number(e.target.value || 0) } })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Discount (CZK)</Label>
                                <Input data-testid="finance-discount" type="number" value={form.finance.discount} onChange={(e) => setForm({ ...form, finance: { ...form.finance, discount: Number(e.target.value || 0) } })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
                        <Button data-testid="job-save-btn" onClick={onSave} disabled={saving} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 gap-2">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {editing ? "Save changes" : "Create job"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
