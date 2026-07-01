import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import api, { fileUrl, downloadFile } from "../lib/api";
import { useT } from "../i18n/I18nContext";
import { fmtMoney, fmtDateTime } from "../lib/format";
import AuthImage from "../components/houston/AuthImage";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Printer, ChevronLeft, FileCheck2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Job Sheet / Customer Report — print-ready document.
 * Two modes:
 *   - /reports → picker + preview (admin/collaborator)
 *   - /reports/job/:id → directly opens the picked job
 *
 * Controls (do NOT print):
 *   - include prices
 *   - include checklist summary
 *   - include selected photos
 *
 * Hidden by design from the report:
 *   - internal_notes
 *   - secrets
 *   - audit / system info
 */
export default function Reports() {
    const { id: paramId } = useParams();
    const navigate = useNavigate();
    const t = useT();
    const [jobs, setJobs] = useState([]);
    const [selectedId, setSelectedId] = useState(paramId || "");
    const [job, setJob] = useState(null);
    const [client, setClient] = useState(null);
    const [device, setDevice] = useState(null);
    const [settings, setSettings] = useState(null);

    const [opts, setOpts] = useState({ prices: true, checklist: true, photos: true });
    const [downloading, setDownloading] = useState(false);

    const onDownloadPdf = async () => {
        if (!job || downloading) return;
        setDownloading(true);
        try {
            const params = new URLSearchParams({
                prices: String(opts.prices),
                checklist: String(opts.checklist),
                photos: String(opts.photos),
            });
            await downloadFile(`/jobs/${job.id}/report.pdf?${params.toString()}`, `${job.code}-job-sheet.pdf`);
        } catch (e) {
            toast.error("Could not generate the PDF. Please try again.");
        } finally {
            setDownloading(false);
        }
    };

    useEffect(() => {
        (async () => {
            const [j, s] = await Promise.all([api.get("/jobs"), api.get("/settings")]);
            setJobs(j.data || []);
            setSettings(s.data || {});
        })();
    }, []);

    useEffect(() => {
        if (!selectedId) { setJob(null); return; }
        (async () => {
            const r = await api.get(`/jobs/${selectedId}`);
            setJob(r.data);
            if (r.data.client_id) {
                api.get(`/clients/${r.data.client_id}`).then((cr) => setClient(cr.data)).catch(() => {});
            }
            if (r.data.device_id) {
                api.get(`/devices/${r.data.device_id}`).then((dr) => setDevice(dr.data)).catch(() => {});
            }
        })();
    }, [selectedId]);

    const onPick = (val) => {
        setSelectedId(val);
        navigate(`/reports/job/${val}`, { replace: true });
    };

    const visiblePhotos = useMemo(() => {
        if (!opts.photos || !job?.attachments) return [];
        return job.attachments
            .filter((a) => (a.mime || "").startsWith("image/"))
            .filter((a) => a.customer_visible !== false)
            .slice(0, 9);
    }, [job, opts.photos]);

    const total = job ? (job.finance?.labor_price || 0) + (job.finance?.parts_price || 0) - (job.finance?.discount || 0) : 0;
    const checklistDone = job ? (job.checklist || []).filter((c) => c.done).length : 0;

    return (
        <div className="space-y-6 hl-fade-up">
            <div className="flex items-end justify-between flex-wrap gap-4 print:hidden">
                <div>
                    <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1.5">// Customer report</div>
                    <h1 className="text-3xl font-semibold tracking-tight text-white">{t("nav.reports")}</h1>
                    <p className="text-sm text-zinc-500 mt-1">Generate a clean, print-ready job sheet for the customer.</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {paramId && (
                        <Button asChild variant="outline" className="border-[var(--hl-border)] bg-[var(--hl-card)]">
                            <Link to={`/jobs/${paramId}`}><ChevronLeft className="h-4 w-4 mr-1" /> Back to job</Link>
                        </Button>
                    )}
                    <Button data-testid="report-download-pdf-btn" onClick={onDownloadPdf} disabled={!job || downloading}
                        variant="outline" className="border-[var(--hl-border)] bg-[var(--hl-card)] gap-2">
                        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PDF
                    </Button>
                    <Button data-testid="report-print-btn" onClick={() => window.print()} disabled={!job}
                        className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 gap-2">
                        <Printer className="h-4 w-4" /> Print / PDF
                    </Button>
                </div>
            </div>

            <div className="hl-card p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
                <div className="md:col-span-2">
                    <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500 mb-1.5 block">Job</Label>
                    <Select value={selectedId} onValueChange={onPick}>
                        <SelectTrigger data-testid="report-select-job" className="bg-[var(--hl-input)] border-[var(--hl-border)]">
                            <SelectValue placeholder="Select a job…" />
                        </SelectTrigger>
                        <SelectContent>
                            {jobs.map((j) => (
                                <SelectItem key={j.id} value={j.id} data-testid={`report-job-opt-${j.id}`}>
                                    {j.code} · {j.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-3">
                    <Switch data-testid="report-opt-prices" checked={opts.prices} onCheckedChange={(v) => setOpts({ ...opts, prices: v })} />
                    <Label className="text-sm">Include prices</Label>
                </div>
                <div className="flex items-center gap-3">
                    <Switch data-testid="report-opt-checklist" checked={opts.checklist} onCheckedChange={(v) => setOpts({ ...opts, checklist: v })} />
                    <Label className="text-sm">Include checklist</Label>
                </div>
                <div className="flex items-center gap-3">
                    <Switch data-testid="report-opt-photos" checked={opts.photos} onCheckedChange={(v) => setOpts({ ...opts, photos: v })} />
                    <Label className="text-sm">Include photos</Label>
                </div>
            </div>

            {!job ? (
                <div className="hl-card p-12 text-center text-zinc-500 print:hidden">
                    <FileCheck2 className="h-8 w-8 mx-auto mb-3 text-zinc-700" />
                    Pick a job above to preview the customer report.
                </div>
            ) : (
                <div data-testid="report-sheet" className="report-sheet hl-card p-10 print:p-12 print:bg-white print:text-zinc-900 print:shadow-none">
                    {/* Header */}
                    <header className="flex items-start justify-between border-b border-[var(--hl-border-subtle)] print:border-zinc-300 pb-6">
                        <div>
                            <div className="text-xs hl-mono uppercase tracking-[0.3em] text-emerald-500/80 print:text-emerald-700 mb-2">
                                {settings?.brand_name || "HoustonLab"} · Customer Report
                            </div>
                            <div className="text-2xl font-semibold text-white print:text-zinc-900">{job.title}</div>
                            <div className="text-sm hl-mono text-zinc-500 print:text-zinc-500 mt-1">{job.code} · {job.category}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Generated</div>
                            <div className="text-sm hl-mono text-zinc-300 print:text-zinc-700">{fmtDateTime(new Date().toISOString())}</div>
                        </div>
                    </header>

                    {/* Client + Device */}
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                        <div>
                            <div className="text-xs hl-mono uppercase tracking-widest text-zinc-500 mb-2">Client</div>
                            <div className="text-zinc-200 print:text-zinc-900">{client?.full_name || "—"}</div>
                            {client?.phone && <div className="text-xs text-zinc-500">{client.phone}</div>}
                            {client?.email && <div className="text-xs text-zinc-500">{client.email}</div>}
                            {client?.address && <div className="text-xs text-zinc-500">{client.address}</div>}
                        </div>
                        <div>
                            <div className="text-xs hl-mono uppercase tracking-widest text-zinc-500 mb-2">Device</div>
                            {device ? (
                                <>
                                    <div className="text-zinc-200 print:text-zinc-900">{device.name}</div>
                                    <div className="text-xs text-zinc-500">
                                        {[device.brand, device.model, device.device_type].filter(Boolean).join(" · ")}
                                    </div>
                                    {device.serial && <div className="text-xs text-zinc-500 hl-mono">SN: {device.serial}</div>}
                                </>
                            ) : <div className="text-zinc-500">—</div>}
                        </div>
                    </section>

                    {/* Dates + status */}
                    <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 text-sm">
                        <div>
                            <div className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Received</div>
                            <div className="text-zinc-300 print:text-zinc-800">{job.received_date ? fmtDateTime(job.received_date) : "—"}</div>
                        </div>
                        <div>
                            <div className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Completed</div>
                            <div className="text-zinc-300 print:text-zinc-800">{job.completed_date ? fmtDateTime(job.completed_date) : "—"}</div>
                        </div>
                        <div>
                            <div className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Status</div>
                            <div className="text-zinc-300 print:text-zinc-800">{job.status}</div>
                        </div>
                        <div>
                            <div className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Priority</div>
                            <div className="text-zinc-300 print:text-zinc-800">{job.priority}</div>
                        </div>
                    </section>

                    {/* Customer summary + work performed */}
                    {(job.customer_summary || job.description) && (
                        <section className="mt-8">
                            <div className="text-xs hl-mono uppercase tracking-widest text-zinc-500 mb-2">Summary</div>
                            <div className="text-zinc-300 print:text-zinc-800 whitespace-pre-wrap leading-relaxed">
                                {job.customer_summary || job.description}
                            </div>
                        </section>
                    )}

                    {Array.isArray(job.timeline) && job.timeline.length > 0 && (
                        <section className="mt-8">
                            <div className="text-xs hl-mono uppercase tracking-widest text-zinc-500 mb-3">Work performed</div>
                            <ul className="space-y-1.5 text-sm text-zinc-300 print:text-zinc-800">
                                {job.timeline
                                    .filter((e) => e.customer_visible !== false && e.type !== "Note")
                                    .slice(0, 12)
                                    .map((e) => (
                                        <li key={e.id} className="flex gap-2">
                                            <span className="hl-mono text-[11px] uppercase tracking-widest text-zinc-500 w-32 shrink-0">{e.type}</span>
                                            <span>{e.text}</span>
                                        </li>
                                    ))}
                            </ul>
                        </section>
                    )}

                    {/* Checklist summary */}
                    {opts.checklist && Array.isArray(job.checklist) && job.checklist.length > 0 && (
                        <section className="mt-8">
                            <div className="flex justify-between items-center mb-2">
                                <div className="text-xs hl-mono uppercase tracking-widest text-zinc-500">Checklist</div>
                                <div className="text-xs hl-mono text-zinc-500">{checklistDone}/{job.checklist.length} done</div>
                            </div>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                                {job.checklist.map((c) => (
                                    <li key={c.id} className="flex items-center gap-2 text-zinc-300 print:text-zinc-800">
                                        <span className={`inline-block h-3 w-3 rounded-sm border ${c.done ? "bg-emerald-500 border-emerald-500" : "border-zinc-600 print:border-zinc-400"}`} />
                                        <span className={c.done ? "" : "opacity-60"}>{c.text}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Photos */}
                    {opts.photos && visiblePhotos.length > 0 && (
                        <section className="mt-8">
                            <div className="text-xs hl-mono uppercase tracking-widest text-zinc-500 mb-3">Photos</div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {visiblePhotos.map((a) => (
                                    <AuthImage key={a.id} src={fileUrl(a.url)} alt={a.original_name}
                                        className="w-full aspect-square object-cover rounded print:rounded-none border border-[var(--hl-border-subtle)] print:border-zinc-300" />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Pricing */}
                    {opts.prices && (
                        <section className="mt-8 border-t border-[var(--hl-border-subtle)] print:border-zinc-300 pt-6">
                            <div className="text-xs hl-mono uppercase tracking-widest text-zinc-500 mb-3">Price summary</div>
                            <div className="grid grid-cols-2 gap-y-1 max-w-md">
                                <div className="text-zinc-400 print:text-zinc-700">Labor</div>
                                <div className="hl-mono text-right text-zinc-300 print:text-zinc-900">{fmtMoney(job.finance?.labor_price || 0)}</div>
                                <div className="text-zinc-400 print:text-zinc-700">Parts</div>
                                <div className="hl-mono text-right text-zinc-300 print:text-zinc-900">{fmtMoney(job.finance?.parts_price || 0)}</div>
                                {(job.finance?.discount || 0) > 0 && (
                                    <>
                                        <div className="text-zinc-400 print:text-zinc-700">Discount</div>
                                        <div className="hl-mono text-right text-zinc-300 print:text-zinc-900">−{fmtMoney(job.finance?.discount || 0)}</div>
                                    </>
                                )}
                                <div className="text-zinc-200 print:text-zinc-900 font-medium border-t border-[var(--hl-border-subtle)] print:border-zinc-300 pt-2 mt-1">Total</div>
                                <div className="hl-mono text-right text-emerald-300 print:text-emerald-700 font-semibold border-t border-[var(--hl-border-subtle)] print:border-zinc-300 pt-2 mt-1">{fmtMoney(total)}</div>
                                <div className="text-zinc-400 print:text-zinc-700">Payment</div>
                                <div className="hl-mono text-right text-zinc-300 print:text-zinc-900">{job.finance?.payment_status || "—"}</div>
                            </div>
                        </section>
                    )}

                    {/* Footer */}
                    <footer className="mt-12 pt-6 border-t border-[var(--hl-border-subtle)] print:border-zinc-300 text-xs hl-mono text-zinc-500 print:text-zinc-500 flex justify-between">
                        <span>{settings?.brand_name || "HoustonLab"} · {job.code}</span>
                        <span>Thank you for your trust.</span>
                    </footer>
                </div>
            )}
        </div>
    );
}
