import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";

export default function DynamicFields({ fields = [], values = {}, onChange }) {
    if (!fields?.length) {
        return <div className="text-sm text-zinc-500">No custom fields for this template.</div>;
    }
    const set = (k, v) => onChange({ ...values, [k]: v });
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {fields.map((f) => {
                const id = `cf-${f.key}`;
                const inputCls = "bg-[var(--hl-input)] border-[var(--hl-border)]";
                const wrap = (children, span = 1) => (
                    <div key={f.key} className={span === 2 ? "md:col-span-2 space-y-2" : "space-y-2"}>
                        <Label htmlFor={id} className="text-xs hl-mono uppercase tracking-widest text-zinc-500">
                            {f.label}{f.required && <span className="text-red-400 ml-1">*</span>}
                        </Label>
                        {children}
                    </div>
                );
                switch (f.type) {
                    case "textarea":
                        return wrap(<Textarea data-testid={`cf-${f.key}`} id={id} value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} className={`${inputCls} min-h-[90px]`} />, 2);
                    case "number":
                        return wrap(<Input data-testid={`cf-${f.key}`} id={id} type="number" value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value === "" ? "" : Number(e.target.value))} className={inputCls} />);
                    case "date":
                        return wrap(<Input data-testid={`cf-${f.key}`} id={id} type="date" value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} className={inputCls} />);
                    case "url":
                        return wrap(<Input data-testid={`cf-${f.key}`} id={id} type="url" value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} placeholder="https://…" className={inputCls} />);
                    case "checkbox":
                        return wrap(
                            <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox data-testid={`cf-${f.key}`} checked={!!values[f.key]} onCheckedChange={(v) => set(f.key, !!v)} />
                                <span className="text-sm text-zinc-400">Yes</span>
                            </label>
                        );
                    case "select":
                        return wrap(
                            <Select value={values[f.key] || ""} onValueChange={(v) => set(f.key, v)}>
                                <SelectTrigger data-testid={`cf-${f.key}`} className={inputCls}><SelectValue placeholder="Select…" /></SelectTrigger>
                                <SelectContent>
                                    {(f.options || []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        );
                    case "secret":
                        return wrap(<Input data-testid={`cf-${f.key}`} id={id} type="password" value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} className={inputCls} />);
                    default:
                        return wrap(<Input data-testid={`cf-${f.key}`} id={id} value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} className={inputCls} />);
                }
            })}
        </div>
    );
}
