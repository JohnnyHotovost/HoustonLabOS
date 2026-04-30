import { useEffect, useState } from "react";
import api from "../lib/api";
import { useT } from "../i18n/I18nContext";
import { Button } from "../components/ui/button";
import { FileCode2, ChevronRight, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

export default function TemplatesPage() {
    const [templates, setTemplates] = useState([]);
    const [active, setActive] = useState(null);
    const t = useT();

    useEffect(() => { (async () => { const r = await api.get("/templates"); setTemplates(r.data); })(); }, []);

    return (
        <div className="space-y-7 hl-fade-up">
            <div>
                <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1.5">{t("templates.kicker")}</div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">{t("templates.title")}</h1>
                <p className="text-sm text-zinc-500 mt-1">{t("templates.subtitle", { count: templates.length })}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((tpl) => (
                    <button data-testid={`template-row-${tpl.id}`} key={tpl.id} onClick={() => setActive(tpl)} className="hl-card p-5 text-left hover:border-emerald-500/30 group">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500">{tpl.category}</div>
                                <div className="text-base font-medium text-white mt-1 group-hover:text-emerald-300">{tpl.name}</div>
                            </div>
                            {tpl.is_predefined && <span className="hl-mono text-[10px] text-emerald-400/80 border border-emerald-500/20 rounded-full px-2 py-0.5">{t("templates.predefined")}</span>}
                        </div>
                        <div className="text-[12px] text-zinc-500 mt-2 line-clamp-2">{tpl.description}</div>
                        <div className="flex items-center gap-3 mt-4 text-[11px] hl-mono text-zinc-500">
                            <span>{t("templates.fields_count", { n: tpl.fields.length })}</span>
                            <span className="text-zinc-700">·</span>
                            <span>{t("templates.checklist_count", { n: tpl.checklist.length })}</span>
                            <span className="text-zinc-700">·</span>
                            <span>{t("templates.file_groups", { n: tpl.attachment_categories?.length || 0 })}</span>
                            {tpl.supports_secrets && <><span className="text-zinc-700">·</span><span className="text-emerald-400">{t("templates.secrets")}</span></>}
                        </div>
                    </button>
                ))}
            </div>

            <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
                <DialogContent className="bg-[var(--hl-card)] border-[var(--hl-border)] max-w-2xl max-h-[80vh] overflow-y-auto">
                    {active && (
                        <>
                            <DialogHeader>
                                <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1">{active.category}</div>
                                <DialogTitle className="text-2xl">{active.name}</DialogTitle>
                                <div className="text-sm text-zinc-400">{active.description}</div>
                            </DialogHeader>
                            <div className="space-y-5 mt-4">
                                <div>
                                    <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">{t("templates.fields", { n: active.fields.length })}</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                                        {active.fields.map((f) => (
                                            <div key={f.key} className="flex justify-between border-b border-[var(--hl-border-subtle)] py-1.5">
                                                <span className="text-zinc-300">{f.label}</span>
                                                <span className="hl-mono text-[10px] text-zinc-500 uppercase">{f.type}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">{t("templates.default_checklist")}</div>
                                    <div className="space-y-1.5">
                                        {active.checklist.map((c, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                                                {c}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">{t("templates.attachment_categories")}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {active.attachment_categories.map((c) => <span key={c} className="text-[11px] hl-mono text-zinc-400 border border-[var(--hl-border)] rounded-full px-2 py-0.5">{c}</span>)}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
