import { Inbox } from "lucide-react";

export function EmptyState({ icon: Icon = Inbox, title = "Nothing here yet", description, action, testId }) {
    return (
        <div data-testid={testId || "empty-state"} className="border border-dashed border-[var(--hl-border)] rounded-xl px-6 py-16 flex flex-col items-center text-center bg-[var(--hl-card)]/40">
            <Icon className="h-10 w-10 text-zinc-600 mb-4" strokeWidth={1.5} />
            <div className="text-base text-zinc-300 font-medium">{title}</div>
            {description && <div className="text-sm text-zinc-500 mt-1.5 max-w-sm">{description}</div>}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}
