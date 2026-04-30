import { useState } from "react";
import { useT } from "../../i18n/I18nContext";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Calendar } from "lucide-react";

export const RANGE_KEYS = ["today", "week", "month", "year", "6m", "all", "custom"];

/**
 * Date-range selector wired to backend `?range=` (and optional from/to for custom).
 * value: { key, from?, to? }   onChange(value)
 */
export default function RangePicker({ value, onChange, testId = "range-picker" }) {
    const t = useT();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState({ from: value?.from || "", to: value?.to || "" });

    const handleSelect = (key) => {
        if (key === "custom") {
            setDraft({ from: value?.from || "", to: value?.to || "" });
            // Defer opening the dialog past the Select's portal unmount so they don't fight.
            setTimeout(() => setOpen(true), 50);
            return;
        }
        onChange({ key });
    };

    const applyCustom = () => {
        onChange({ key: "custom", from: draft.from || undefined, to: draft.to || undefined });
        setOpen(false);
    };

    const label = (k) => ({
        today: t("range.today"),
        week: t("range.week"),
        month: t("range.month"),
        year: t("range.year"),
        "6m": t("range.6m"),
        all: t("range.all"),
        custom: t("range.custom"),
    }[k] || k);

    return (
        <div className="flex items-center gap-2">
            <span className="hl-mono text-[10px] uppercase tracking-widest text-zinc-500 hidden sm:inline">
                {t("range.label")}
            </span>
            <Select value={value?.key || "6m"} onValueChange={handleSelect}>
                <SelectTrigger
                    data-testid={testId}
                    className="w-[180px] bg-[var(--hl-card)] border-[var(--hl-border)] hl-mono text-xs"
                >
                    <Calendar className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {RANGE_KEYS.map((k) => (
                        <SelectItem key={k} value={k} data-testid={`${testId}-opt-${k}`}>
                            {label(k)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    data-testid={`${testId}-custom-popover`}
                    className="bg-[var(--hl-card)] border-[var(--hl-border)] sm:max-w-md"
                >
                    <DialogHeader>
                        <DialogTitle>{t("range.custom")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">
                                {t("range.from")}
                            </Label>
                            <Input
                                type="date"
                                data-testid={`${testId}-custom-from`}
                                value={draft.from?.slice(0, 10) || ""}
                                onChange={(e) =>
                                    setDraft({ ...draft, from: e.target.value ? `${e.target.value}T00:00:00Z` : "" })
                                }
                                className="bg-[var(--hl-input)] border-[var(--hl-border)]"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">
                                {t("range.to")}
                            </Label>
                            <Input
                                type="date"
                                data-testid={`${testId}-custom-to`}
                                value={draft.to?.slice(0, 10) || ""}
                                onChange={(e) =>
                                    setDraft({ ...draft, to: e.target.value ? `${e.target.value}T23:59:59Z` : "" })
                                }
                                className="bg-[var(--hl-input)] border-[var(--hl-border)]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)}>
                            {t("common.cancel")}
                        </Button>
                        <Button
                            data-testid={`${testId}-custom-apply`}
                            onClick={applyCustom}
                            className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950"
                        >
                            {t("range.apply")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/** Build query params suitable for axios `params:` from a range value. */
export function rangeParams(range) {
    if (!range) return { range: "6m" };
    if (range.key === "custom") {
        const p = { range: "custom" };
        if (range.from) p.from = range.from;
        if (range.to) p.to = range.to;
        return p;
    }
    return { range: range.key || "6m" };
}

/** Pretty label for series buckets returned by the backend (day/week/month). */
export function formatBucketLabel(bucket) {
    if (!bucket) return "";
    // Day: 2025-11-04
    if (/^\d{4}-\d{2}-\d{2}$/.test(bucket)) {
        const [, m, d] = bucket.split("-");
        return `${d}.${m}.`;
    }
    // Week: 2025-W12
    if (/^\d{4}-W\d{2}$/.test(bucket)) return bucket.split("-")[1];
    // Month: 2025-11
    if (/^\d{4}-\d{2}$/.test(bucket)) {
        const [y, m] = bucket.split("-");
        return `${m}/${y.slice(2)}`;
    }
    return bucket;
}
