import { format, formatDistanceToNow, parseISO } from "date-fns";

export function fmtDate(d) {
    if (!d) return "—";
    try {
        return format(typeof d === "string" ? parseISO(d) : d, "MMM d, yyyy");
    } catch { return "—"; }
}

export function fmtDateTime(d) {
    if (!d) return "—";
    try {
        return format(typeof d === "string" ? parseISO(d) : d, "MMM d, yyyy · HH:mm");
    } catch { return "—"; }
}

export function fmtRelative(d) {
    if (!d) return "—";
    try {
        return formatDistanceToNow(typeof d === "string" ? parseISO(d) : d, { addSuffix: true });
    } catch { return "—"; }
}

export function fmtMoney(amount, currency = "CZK") {
    const n = Number(amount || 0);
    return `${n.toLocaleString("cs-CZ")} ${currency}`;
}

export const STATUS_OPTIONS = [
    "New", "Diagnosing", "Waiting for Parts", "In Progress", "Testing", "Ready for Pickup", "Completed", "Cancelled"
];
export const PRIORITY_OPTIONS = ["Low", "Normal", "High", "Urgent"];
export const PAYMENT_STATUS_OPTIONS = ["Unpaid", "Partial", "Paid"];
export const PAYMENT_METHOD_OPTIONS = ["Cash", "Bank Transfer", "Card", "Other"];
export const TIMELINE_TYPES = ["Note", "Diagnosis", "Repair", "Part Installed", "Test", "Customer Update", "Payment", "Problem"];
export const DEVICE_TYPES = ["Desktop PC", "Gaming PC", "Laptop", "Console", "iPhone", "MacBook", "Router", "Switch", "Access Point", "NAS", "Server", "Monitor", "Other"];
export const JOB_CATEGORIES = [
    "Custom PC Build", "PC Repair", "PC Cleaning", "Laptop Service", "Console Service",
    "Apple/iPhone", "Networking", "UniFi Setup", "NAS/Server", "Minecraft Server Hosting",
    "Game Server Hosting", "Website/Hosting", "Consultation", "Other"
];
