import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api, { fileUrl, downloadFile } from "../lib/api";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { StatusBadge, PriorityBadge, PaymentBadge } from "../components/houston/Badges";
import { ChevronLeft, Pencil, Plus, Trash2, Eye, EyeOff, Copy, Lock, Upload, Image as ImageIcon, Paperclip, Check, X, Activity, ListChecks, FileText, Cpu, User, Wallet, KeyRound, StickyNote, GalleryVertical, Loader2 } from "lucide-react";
import { fmtMoney, fmtDateTime, fmtRelative, STATUS_OPTIONS, PRIORITY_OPTIONS, PAYMENT_STATUS_OPTIONS, PAYMENT_METHOD_OPTIONS, TIMELINE_TYPES } from "../lib/format";
import { toast } from "sonner";
import { EmptyState } from "../components/houston/EmptyState";
import AuthImage from "../components/houston/AuthImage";

const ENTRY_DOT = {
    "Note": "bg-zinc-500", "Diagnosis": "bg-blue-400", "Repair": "bg-emerald-400",
    "Part Installed": "bg-cyan-400", "Test": "bg-indigo-400",
    "Customer Update": "bg-yellow-400", "Payment": "bg-emerald-300", "Problem": "bg-red-400",
};

export default function JobDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const fileInput = useRef(null);

    const reload = async () => {
        const { data } = await api.get(`/jobs/${id}`);
        setJob(data);
    };
    useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id]);

    if (!job) return <div className="text-zinc-500 text-sm">Loading…</div>;

    const total = (job.finance?.labor_price || 0) + (job.finance?.parts_price || 0) - (job.finance?.discount || 0);

    const updateStatus = async (s) => {
        const payload = sanitizeForUpdate({ ...job, status: s });
        await api.put(`/jobs/${id}`, payload);
        toast.success(`Status: ${s}`);
        reload();
    };

    const onUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fd = new FormData();
        fd.append("file", file);
        fd.append("job_id", id);
        try {
            await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
            toast.success("File uploaded");
            reload();
        } catch (err) {
            toast.error("Upload failed");
        }
        e.target.value = "";
    };

    const photoAttachments = (job.attachments || []).filter((a) => a.mime?.startsWith("image/"));
    const otherAttachments = (job.attachments || []).filter((a) => !a.mime?.startsWith("image/"));

    return (
        <div className="space-y-6 hl-fade-up">
            <button onClick={() => navigate(-1)} data-testid="job-detail-back" className="text-sm text-zinc-500 hover:text-zinc-200 flex items-center gap-1.5"><ChevronLeft className="h-4 w-4" /> Back</button>

            {/* Header */}
            <div className="hl-card p-6">
                <div className="flex items-start justify-between gap-6 flex-wrap">
                    <div className="min-w-0">
                        <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1.5">{job.code} · {job.category}</div>
                        <h1 data-testid="job-detail-title" className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">{job.title}</h1>
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                            <StatusBadge value={job.status} />
                            <PriorityBadge value={job.priority} />
                            <PaymentBadge value={job.finance?.payment_status} />
                            {job.tags?.map((t) => <span key={t} className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500 border border-[var(--hl-border)] rounded-full px-2 py-0.5">#{t}</span>)}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={job.status} onValueChange={updateStatus}>
                            <SelectTrigger data-testid="job-status-quick" className="w-[180px] bg-[var(--hl-card)] border-[var(--hl-border)]"><SelectValue /></SelectTrigger>
                            <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button data-testid="job-edit-btn" variant="outline" className="border-[var(--hl-border)] bg-[var(--hl-card)] hover:bg-[var(--hl-elevated)]" onClick={() => navigate(`/jobs/${id}/edit`)}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                        </Button>
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-6 pt-5 border-t border-[var(--hl-border-subtle)]">
                    <Meta label="Client" value={job.client ? <Link to={`/clients/${job.client.id}`} className="hover:text-emerald-300">{job.client.full_name}</Link> : "—"} />
                    <Meta label="Device" value={job.device ? <Link to={`/devices/${job.device.id}`} className="hover:text-emerald-300">{job.device.name}</Link> : "—"} />
                    <Meta label="Deadline" value={job.deadline ? fmtRelative(job.deadline) : "—"} />
                    <Meta label="Total" value={<span className="hl-mono">{fmtMoney(total)}</span>} />
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-5">
                <TabsList className="bg-[var(--hl-elevated)] p-1 rounded-lg border border-[var(--hl-border-subtle)] flex-wrap h-auto">
                    {[
                        { v: "overview", label: "Overview", icon: FileText },
                        { v: "timeline", label: "Timeline", icon: Activity },
                        { v: "checklist", label: "Checklist", icon: ListChecks },
                        { v: "files", label: "Files", icon: Paperclip },
                        { v: "gallery", label: "Gallery", icon: GalleryVertical },
                        { v: "device", label: "Device", icon: Cpu },
                        { v: "client", label: "Client", icon: User },
                        { v: "finance", label: "Finance", icon: Wallet },
                        { v: "secrets", label: "Secrets", icon: KeyRound },
                        { v: "notes", label: "Notes", icon: StickyNote },
                    ].map(({ v, label, icon: Icon }) => (
                        <TabsTrigger key={v} value={v} data-testid={`tab-${v}`} className="tab-pill text-zinc-400 data-[state=active]:text-white gap-1.5">
                            <Icon className="h-3.5 w-3.5" />{label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value="overview" className="space-y-5">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <div className="lg:col-span-2 hl-card p-6 space-y-5">
                            <div>
                                <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Description</div>
                                <div className="text-sm text-zinc-300 whitespace-pre-wrap">{job.description || "—"}</div>
                            </div>
                            <div>
                                <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Customer summary</div>
                                <div className="text-sm text-zinc-300 whitespace-pre-wrap">{job.customer_summary || "—"}</div>
                            </div>
                            {job.template?.fields?.length > 0 && (
                                <div>
                                    <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Template details</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                        {job.template.fields.map((f) => (
                                            <div key={f.key} className="flex justify-between gap-3 border-b border-[var(--hl-border-subtle)] py-1.5">
                                                <span className="text-zinc-500">{f.label}</span>
                                                <span className="text-zinc-200 hl-mono text-xs text-right truncate max-w-[60%]">{formatValue(job.custom_fields?.[f.key])}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="space-y-5">
                            <div className="hl-card p-6">
                                <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Progress</div>
                                <ChecklistProgress checklist={job.checklist || []} />
                            </div>
                            <div className="hl-card p-6">
                                <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Recent timeline</div>
                                {(job.timeline || []).slice(-4).reverse().map((e) => (
                                    <div key={e.id} className="flex gap-3 mb-3 last:mb-0">
                                        <div className={`h-1.5 w-1.5 rounded-full mt-1.5 ${ENTRY_DOT[e.type] || "bg-zinc-500"}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500">{e.type}</div>
                                            <div className="text-sm text-zinc-300">{e.text}</div>
                                            <div className="text-[10px] text-zinc-600 hl-mono">{fmtRelative(e.created_at)}</div>
                                        </div>
                                    </div>
                                ))}
                                {!job.timeline?.length && <div className="text-sm text-zinc-500">No entries.</div>}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="timeline"><TimelineTab job={job} reload={reload} /></TabsContent>
                <TabsContent value="checklist"><ChecklistTab job={job} reload={reload} /></TabsContent>
                <TabsContent value="files">
                    <FilesTab job={job} reload={reload} fileInput={fileInput} onUpload={onUpload} attachments={otherAttachments.concat(photoAttachments)} />
                </TabsContent>
                <TabsContent value="gallery">
                    <GalleryTab attachments={photoAttachments} onUploadClick={() => fileInput.current?.click()} fileInput={fileInput} onUpload={onUpload} />
                </TabsContent>
                <TabsContent value="device">
                    {job.device ? <DeviceCard d={job.device} /> : <EmptyState title="No device linked" description="This job has no associated device." />}
                </TabsContent>
                <TabsContent value="client">
                    {job.client ? <ClientCard c={job.client} /> : <EmptyState title="No client linked" description="This job has no associated client." />}
                </TabsContent>
                <TabsContent value="finance"><FinanceTab job={job} reload={reload} /></TabsContent>
                <TabsContent value="secrets"><SecretsTab job={job} reload={reload} /></TabsContent>
                <TabsContent value="notes">
                    <div className="hl-card p-6 space-y-5">
                        <div>
                            <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Internal notes</div>
                            <div className="text-sm text-zinc-300 whitespace-pre-wrap">{job.internal_notes || "—"}</div>
                        </div>
                        <div>
                            <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Customer-visible summary</div>
                            <div className="text-sm text-zinc-300 whitespace-pre-wrap">{job.customer_summary || "—"}</div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
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

function formatValue(v) {
    if (v === true) return "Yes";
    if (v === false) return "No";
    if (v === null || v === undefined || v === "") return "—";
    return String(v);
}

function ChecklistProgress({ checklist }) {
    const total = checklist.length;
    const done = checklist.filter((c) => c.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return (
        <div>
            <div className="flex justify-between text-xs mb-2">
                <span className="text-zinc-300 hl-mono">{done}/{total} done</span>
                <span className="text-emerald-400 hl-mono">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

function TimelineTab({ job, reload }) {
    const [type, setType] = useState("Note");
    const [text, setText] = useState("");
    const [adding, setAdding] = useState(false);
    const add = async () => {
        if (!text.trim()) return;
        setAdding(true);
        try {
            await api.post(`/jobs/${job.id}/timeline`, { type, text, customer_visible: false });
            setText(""); reload();
        } finally { setAdding(false); }
    };
    const del = async (eid) => {
        await api.delete(`/jobs/${job.id}/timeline/${eid}`);
        reload();
    };
    const sorted = [...(job.timeline || [])].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 hl-card p-6">
                {sorted.length === 0 ? (
                    <EmptyState icon={Activity} title="No timeline entries" description="Add diagnosis, repair, test or note entries as work progresses." />
                ) : (
                    <div className="relative pl-6">
                        <div className="absolute left-2 top-1 bottom-1 timeline-line" />
                        {sorted.map((e) => (
                            <div key={e.id} data-testid={`timeline-entry-${e.id}`} className="relative mb-7 last:mb-0 group">
                                <div className={`absolute -left-[18px] top-1 h-3 w-3 rounded-full border-2 border-[var(--hl-bg)] ${ENTRY_DOT[e.type] || "bg-zinc-500"}`} />
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500">{e.type}</span>
                                    <span className="text-zinc-700">·</span>
                                    <span className="hl-mono text-[10px] text-zinc-500">{fmtDateTime(e.created_at)}</span>
                                    <button data-testid={`delete-timeline-${e.id}`} onClick={() => del(e.id)} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
                                </div>
                                <div className="text-sm text-zinc-200 whitespace-pre-wrap">{e.text}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="hl-card p-6 space-y-3 h-fit">
                <div className="text-base font-medium text-white">Add entry</div>
                <Select value={type} onValueChange={setType}>
                    <SelectTrigger data-testid="timeline-type-select" className="bg-[var(--hl-input)] border-[var(--hl-border)]"><SelectValue /></SelectTrigger>
                    <SelectContent>{TIMELINE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Textarea data-testid="timeline-text-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe what happened…" className="bg-[var(--hl-input)] border-[var(--hl-border)] min-h-[120px]" />
                <Button data-testid="timeline-add-btn" onClick={add} disabled={adding} className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950">
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />} Add to timeline
                </Button>
            </div>
        </div>
    );
}

function ChecklistTab({ job, reload }) {
    const [text, setText] = useState("");
    const items = job.checklist || [];
    const addItem = async () => {
        if (!text.trim()) return;
        await api.post(`/jobs/${job.id}/checklist`, { text, done: false });
        setText(""); reload();
    };
    const toggle = async (it) => {
        await api.put(`/jobs/${job.id}/checklist/${it.id}`, { done: !it.done });
        reload();
    };
    const removeItem = async (it) => {
        await api.delete(`/jobs/${job.id}/checklist/${it.id}`);
        reload();
    };
    return (
        <div className="hl-card p-6">
            <div className="flex items-center justify-between mb-4">
                <ChecklistProgress checklist={items} />
            </div>
            <div className="space-y-1.5">
                {items.length === 0 && <EmptyState icon={ListChecks} title="No checklist items" />}
                {items.map((it) => (
                    <div key={it.id} data-testid={`checklist-item-${it.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--hl-card-hover)] group">
                        <Checkbox data-testid={`checklist-toggle-${it.id}`} checked={!!it.done} onCheckedChange={() => toggle(it)} />
                        <span className={`flex-1 text-sm ${it.done ? "text-zinc-500 line-through" : "text-zinc-200"}`}>{it.text}</span>
                        {it.completed_at && <span className="hl-mono text-[10px] text-zinc-600">{fmtRelative(it.completed_at)}</span>}
                        <button data-testid={`checklist-delete-${it.id}`} onClick={() => removeItem(it)} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                ))}
            </div>
            <div className="mt-5 pt-5 border-t border-[var(--hl-border-subtle)] flex gap-2">
                <Input data-testid="checklist-add-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add new item…" className="bg-[var(--hl-input)] border-[var(--hl-border)]" onKeyDown={(e) => { if (e.key === "Enter") addItem(); }} />
                <Button data-testid="checklist-add-btn" onClick={addItem} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950"><Plus className="h-4 w-4" /></Button>
            </div>
        </div>
    );
}

function FilesTab({ job, reload, fileInput, onUpload, attachments }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-400">{attachments.length} files</div>
                <Button data-testid="files-upload-btn" onClick={() => fileInput.current?.click()} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950"><Upload className="h-4 w-4 mr-2" />Upload</Button>
                <input ref={fileInput} type="file" className="hidden" onChange={onUpload} data-testid="hidden-file-input" />
            </div>
            {attachments.length === 0 ? (
                <EmptyState icon={Paperclip} title="No files yet" description="Upload photos, logs, screenshots, configs and invoices." />
            ) : (
                <div className="hl-card overflow-hidden">
                    <table className="min-w-full text-sm">
                        <thead className="border-b border-[var(--hl-border-subtle)]">
                            <tr className="text-left">
                                <th className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500">File</th>
                                <th className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500">Category</th>
                                <th className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500">Size</th>
                                <th className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500">Uploaded</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {attachments.map((a) => (
                                <tr key={a.id} className="border-b border-[var(--hl-border-subtle)]">
                                    <td className="px-5 py-3"><button onClick={() => downloadFile(a.url, a.original_name)} className="text-emerald-300 hover:text-emerald-200 text-sm text-left">{a.original_name}</button></td>
                                    <td className="px-5 py-3 text-xs text-zinc-400">{a.category || "—"}</td>
                                    <td className="px-5 py-3 hl-mono text-xs text-zinc-400">{Math.round((a.size || 0) / 1024)} KB</td>
                                    <td className="px-5 py-3 hl-mono text-xs text-zinc-500">{fmtRelative(a.created_at)}</td>
                                    <td className="px-5 py-3 text-right">
                                        <button onClick={async () => { await api.delete(`/uploads/${a.id}?job_id=${job.id}`); reload(); }} className="text-zinc-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function GalleryTab({ attachments, onUploadClick, fileInput, onUpload }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-400">{attachments.length} photos</div>
                <Button data-testid="gallery-upload-btn" onClick={onUploadClick} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950"><Upload className="h-4 w-4 mr-2" />Upload photo</Button>
                <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onUpload} />
            </div>
            {attachments.length === 0 ? (
                <EmptyState icon={ImageIcon} title="No photos yet" description="Add before/after, build progress, evidence." />
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {attachments.map((a) => (
                        <button
                            key={a.id}
                            type="button"
                            onClick={() => downloadFile(a.url, a.original_name)}
                            className="hl-card overflow-hidden group block text-left"
                        >
                            <div className="aspect-square bg-zinc-900 overflow-hidden">
                                <AuthImage src={fileUrl(a.url)} alt={a.original_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            </div>
                            <div className="px-3 py-2 text-[11px] text-zinc-500 truncate">{a.category || a.original_name}</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function DeviceCard({ d }) {
    return (
        <div className="hl-card p-6">
            <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1">// Device</div>
            <Link to={`/devices/${d.id}`} className="text-xl font-semibold text-white hover:text-emerald-300">{d.name}</Link>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mt-5">
                <Meta label="Type" value={d.device_type} />
                <Meta label="Brand" value={d.brand || "—"} />
                <Meta label="Model" value={d.model || "—"} />
                <Meta label="Serial" value={<span className="hl-mono text-xs">{d.serial || "—"}</span>} />
                <Meta label="Status" value={d.status || "—"} />
            </div>
            {d.specs && Object.keys(d.specs).length > 0 && (
                <div className="mt-5 pt-5 border-t border-[var(--hl-border-subtle)]">
                    <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Specs</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {Object.entries(d.specs).map(([k, v]) => (
                            <div key={k} className="flex justify-between border-b border-[var(--hl-border-subtle)] py-1.5">
                                <span className="text-zinc-500">{k}</span><span className="hl-mono text-xs text-zinc-200">{String(v)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function ClientCard({ c }) {
    return (
        <div className="hl-card p-6">
            <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1">// Client</div>
            <Link to={`/clients/${c.id}`} className="text-xl font-semibold text-white hover:text-emerald-300">{c.full_name}</Link>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mt-5">
                <Meta label="Phone" value={<span className="hl-mono text-xs">{c.phone || "—"}</span>} />
                <Meta label="Email" value={<span className="hl-mono text-xs">{c.email || "—"}</span>} />
                <Meta label="Address" value={c.address || "—"} />
            </div>
            {c.notes && <div className="mt-5 pt-5 border-t border-[var(--hl-border-subtle)] text-sm text-zinc-300 whitespace-pre-wrap">{c.notes}</div>}
        </div>
    );
}

function FinanceTab({ job, reload }) {
    const [f, setF] = useState({ ...job.finance });
    const [saving, setSaving] = useState(false);
    const total = (f.labor_price || 0) + (f.parts_price || 0) - (f.discount || 0);
    const save = async () => {
        setSaving(true);
        try {
            await api.put(`/jobs/${job.id}/finance`, f);
            toast.success("Finance updated");
            reload();
        } finally { setSaving(false); }
    };
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 hl-card p-6 space-y-5">
                <div className="text-base font-medium text-white">Pricing</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {["labor_price", "parts_price", "discount"].map((k) => (
                        <div key={k} className="space-y-2">
                            <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">{k.replace("_", " ")}</Label>
                            <Input data-testid={`finance-${k}`} type="number" value={f[k] ?? 0} onChange={(e) => setF({ ...f, [k]: Number(e.target.value || 0) })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" />
                        </div>
                    ))}
                </div>
                <div className="text-base font-medium text-white">Payment</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="space-y-2">
                        <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Status</Label>
                        <Select value={f.payment_status} onValueChange={(v) => setF({ ...f, payment_status: v })}>
                            <SelectTrigger className="bg-[var(--hl-input)] border-[var(--hl-border)]"><SelectValue /></SelectTrigger>
                            <SelectContent>{PAYMENT_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Method</Label>
                        <Select value={f.payment_method || "none"} onValueChange={(v) => setF({ ...f, payment_method: v === "none" ? null : v })}>
                            <SelectTrigger className="bg-[var(--hl-input)] border-[var(--hl-border)]"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent><SelectItem value="none">—</SelectItem>{PAYMENT_METHOD_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Paid amount</Label>
                        <Input type="number" value={f.paid_amount ?? 0} onChange={(e) => setF({ ...f, paid_amount: Number(e.target.value || 0) })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Note</Label>
                    <Textarea value={f.payment_note || ""} onChange={(e) => setF({ ...f, payment_note: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" />
                </div>
                <div className="flex justify-end">
                    <Button data-testid="finance-save-btn" onClick={save} disabled={saving} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
                    </Button>
                </div>
            </div>
            <div className="hl-card p-6 h-fit">
                <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Total</div>
                <div className="text-3xl hl-mono text-white">{fmtMoney(total)}</div>
                <div className="hl-divider my-4" />
                <PaymentBadge value={f.payment_status} />
                {f.paid_amount > 0 && <div className="mt-3 text-sm text-zinc-400">Paid: <span className="hl-mono text-zinc-200">{fmtMoney(f.paid_amount)}</span></div>}
                {total - (f.paid_amount || 0) > 0 && f.payment_status !== "Paid" && <div className="mt-1 text-sm text-zinc-400">Outstanding: <span className="hl-mono text-red-300">{fmtMoney(total - (f.paid_amount || 0))}</span></div>}
            </div>
        </div>
    );
}

function SecretsTab({ job, reload }) {
    const [label, setLabel] = useState("");
    const [value, setValue] = useState("");
    const [revealing, setRevealing] = useState(null); // { id, value }
    const [confirmFor, setConfirmFor] = useState(null);
    const [pwd, setPwd] = useState("");
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(null);

    const add = async () => {
        if (!label.trim() || !value) return;
        await api.post(`/jobs/${job.id}/secrets`, { label, value });
        setLabel(""); setValue("");
        toast.success("Secret stored (encrypted)");
        reload();
    };

    const reveal = async () => {
        if (!confirmFor) return;
        setBusy(true);
        try {
            const { data } = await api.post(`/jobs/${job.id}/secrets/${confirmFor.id}/reveal`, { password: pwd });
            setRevealing({ id: confirmFor.id, value: data.value });
            setConfirmFor(null); setPwd("");
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Verification failed");
        } finally { setBusy(false); }
    };

    const copy = async (text, id) => {
        await navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 1500);
        // Audit-only signal — value never leaves the client.
        try { await api.post(`/jobs/${job.id}/secrets/${id}/copied`); } catch { /* noop */ }
    };

    const remove = async (sid) => {
        await api.delete(`/jobs/${job.id}/secrets/${sid}`);
        reload();
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 hl-card p-6 space-y-3">
                <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
                    <Lock className="h-4 w-4 text-emerald-400" /> AES-256-GCM encrypted at rest
                </div>
                {(job.secrets || []).length === 0 ? (
                    <EmptyState icon={KeyRound} title="No secrets stored" description="Store Wi-Fi/admin/API credentials safely encrypted with the server key." />
                ) : (
                    <div className="space-y-2">
                        {(job.secrets || []).map((s) => {
                            const revealed = revealing?.id === s.id;
                            const text = revealed ? revealing.value : "••••••••••••";
                            return (
                                <div key={s.id} data-testid={`secret-row-${s.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--hl-elevated)]/50 border border-[var(--hl-border-subtle)]">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-zinc-200">{s.label}</div>
                                        <div className={`hl-mono text-xs text-emerald-300 mt-0.5 ${revealed ? "" : "secret-blur"}`}>{text}</div>
                                    </div>
                                    {revealed ? (
                                        <Button data-testid={`secret-hide-${s.id}`} variant="ghost" size="sm" onClick={() => setRevealing(null)}><EyeOff className="h-3.5 w-3.5" /></Button>
                                    ) : (
                                        <Button data-testid={`secret-reveal-${s.id}`} variant="ghost" size="sm" onClick={() => setConfirmFor(s)}><Eye className="h-3.5 w-3.5" /></Button>
                                    )}
                                    {revealed && (
                                        <Button data-testid={`secret-copy-${s.id}`} variant="ghost" size="sm" onClick={() => copy(revealing.value, s.id)}>
                                            {copied === s.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                        </Button>
                                    )}
                                    <Button data-testid={`secret-delete-${s.id}`} variant="ghost" size="sm" onClick={() => remove(s.id)} className="text-zinc-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <div className="hl-card p-6 space-y-3 h-fit">
                <div className="text-base font-medium text-white">Add secret</div>
                <Input data-testid="secret-label-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. UniFi admin)" className="bg-[var(--hl-input)] border-[var(--hl-border)]" />
                <Input data-testid="secret-value-input" type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Secret value" className="bg-[var(--hl-input)] border-[var(--hl-border)]" />
                <Button data-testid="secret-add-btn" onClick={add} className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950"><Plus className="h-4 w-4 mr-2" />Encrypt &amp; store</Button>
            </div>

            <Dialog open={!!confirmFor} onOpenChange={(o) => { if (!o) { setConfirmFor(null); setPwd(""); } }}>
                <DialogContent className="bg-[var(--hl-card)] border-[var(--hl-border)]">
                    <DialogHeader><DialogTitle>Confirm to reveal "{confirmFor?.label}"</DialogTitle></DialogHeader>
                    <div className="text-sm text-zinc-500">Re-enter your admin password to decrypt this secret.</div>
                    <Input data-testid="secret-confirm-password" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className="bg-[var(--hl-input)] border-[var(--hl-border)]" />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => { setConfirmFor(null); setPwd(""); }}>Cancel</Button>
                        <Button data-testid="secret-confirm-reveal" onClick={reveal} disabled={busy} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reveal"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function sanitizeForUpdate(j) {
    return {
        title: j.title, template_id: j.template_id, category: j.category,
        status: j.status, priority: j.priority, client_id: j.client_id,
        device_id: j.device_id, received_date: j.received_date, deadline: j.deadline,
        completed_date: j.completed_date, description: j.description,
        internal_notes: j.internal_notes, customer_summary: j.customer_summary,
        tags: j.tags || [], custom_fields: j.custom_fields || {},
        checklist: j.checklist || [], finance: j.finance,
    };
}
