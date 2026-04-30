import { cn } from "../../lib/utils";

const STATUS_MAP = {
    "New": "bg-blue-500/10 text-blue-300 border-blue-500/20",
    "Diagnosing": "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
    "Waiting for Parts": "bg-orange-500/10 text-orange-300 border-orange-500/20",
    "In Progress": "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
    "Testing": "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
    "Ready for Pickup": "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    "Completed": "bg-zinc-800 text-zinc-300 border-zinc-700",
    "Cancelled": "bg-red-500/10 text-red-300 border-red-500/20",
};

const PRIORITY_MAP = {
    "Low": "bg-zinc-800/80 text-zinc-400 border-zinc-700",
    "Normal": "bg-zinc-800 text-zinc-200 border-zinc-700",
    "High": "bg-orange-500/15 text-orange-300 border-orange-500/30",
    "Urgent": "bg-red-500/15 text-red-300 border-red-500/30",
};

const PAY_MAP = {
    "Unpaid": "bg-red-500/10 text-red-300 border-red-500/20",
    "Partial": "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
    "Paid": "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
};

export function StatusBadge({ value, className }) {
    const cls = STATUS_MAP[value] || "bg-zinc-800 text-zinc-300 border-zinc-700";
    return (
        <span data-testid={`status-badge-${value?.toLowerCase().replace(/\s+/g, "-")}`}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider", cls, className)}>
            {value === "Urgent" && <span className="h-1.5 w-1.5 rounded-full bg-current hl-pulse-dot" />}
            {value}
        </span>
    );
}

export function PriorityBadge({ value, className }) {
    const cls = PRIORITY_MAP[value] || "bg-zinc-800 text-zinc-300 border-zinc-700";
    return (
        <span data-testid={`priority-badge-${value?.toLowerCase()}`}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider", cls, className)}>
            {value === "Urgent" && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
            {value}
        </span>
    );
}

export function PaymentBadge({ value, className }) {
    const cls = PAY_MAP[value] || "bg-zinc-800 text-zinc-300 border-zinc-700";
    return (
        <span data-testid={`payment-badge-${value?.toLowerCase()}`}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider", cls, className)}>
            {value}
        </span>
    );
}
