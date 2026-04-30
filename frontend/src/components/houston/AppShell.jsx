import { LayoutGrid, Briefcase, Users, Cpu, Wallet, FileCode2, Settings as SettingsIcon, LogOut, Search, Plus, Command, ZapIcon } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useT } from "../../i18n/I18nContext";
import { Button } from "../ui/button";
import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import api from "../../lib/api";
import MustChangePasswordBanner from "./MustChangePasswordBanner";

const NAV_KEYS = [
    { to: "/", key: "nav.dashboard", icon: LayoutGrid, end: true, testKey: "dashboard" },
    { to: "/jobs", key: "nav.jobs", icon: Briefcase, testKey: "jobs" },
    { to: "/clients", key: "nav.clients", icon: Users, testKey: "clients" },
    { to: "/devices", key: "nav.devices", icon: Cpu, testKey: "devices" },
    { to: "/finance", key: "nav.finance", icon: Wallet, testKey: "finance" },
    { to: "/templates", key: "nav.templates", icon: FileCode2, testKey: "templates" },
    { to: "/settings", key: "nav.settings", icon: SettingsIcon, testKey: "settings" },
];

function Sidebar() {
    const { user, logout } = useAuth();
    const t = useT();
    const navigate = useNavigate();
    return (
        <aside data-testid="app-sidebar" className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-[var(--hl-border)] bg-[var(--hl-sidebar)] h-screen sticky top-0">
            <div className="px-5 py-5 flex items-center gap-2.5 border-b border-[var(--hl-border-subtle)]">
                <div className="relative h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/30 flex items-center justify-center">
                    <ZapIcon className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="leading-tight">
                    <div className="text-sm font-semibold tracking-tight text-white">HoustonLab</div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{t("nav.version_tag")}</div>
                </div>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <div className="px-2 mb-2 text-[10px] font-mono uppercase tracking-widest text-zinc-600">{t("nav.workspace")}</div>
                {NAV_KEYS.map(({ to, key, icon: Icon, end, testKey }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        data-testid={`nav-${testKey}`}
                        className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
                    >
                        <span className="icon-wrap text-zinc-500"><Icon className="h-4 w-4" /></span>
                        <span>{t(key)}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="px-3 py-3 border-t border-[var(--hl-border-subtle)]">
                <div className="flex items-center gap-3 px-2 py-2">
                    <div className="h-8 w-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300 text-xs font-mono">
                        {(user?.name || user?.username || "A").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-zinc-200 truncate">{user?.name || user?.username}</div>
                        <div className="text-[10px] font-mono text-zinc-500 truncate">{user?.email}</div>
                    </div>
                    <Button data-testid="sidebar-logout" size="icon" variant="ghost" className="h-8 w-8 text-zinc-500 hover:text-white" onClick={async () => { await logout(); navigate("/login"); }}>
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </aside>
    );
}

function GlobalSearch({ open, onOpenChange }) {
    const t = useT();
    const [q, setQ] = useState("");
    const [res, setRes] = useState({ jobs: [], clients: [], devices: [] });
    const navigate = useNavigate();
    const inputRef = useRef(null);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 60);
        if (!open) { setQ(""); setRes({ jobs: [], clients: [], devices: [] }); }
    }, [open]);

    useEffect(() => {
        if (!q.trim()) { setRes({ jobs: [], clients: [], devices: [] }); return; }
        const id = setTimeout(async () => {
            try {
                const { data } = await api.get(`/search`, { params: { q } });
                setRes(data);
            } catch { /* noop */ }
        }, 200);
        return () => clearTimeout(id);
    }, [q]);

    const go = (path) => { onOpenChange(false); navigate(path); };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent data-testid="global-search-dialog" className="max-w-2xl bg-[var(--hl-card)] border-[var(--hl-border)] p-0 gap-0 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--hl-border-subtle)]">
                    <Search className="h-4 w-4 text-zinc-500" />
                    <input
                        ref={inputRef}
                        data-testid="global-search-input"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={t("search.placeholder")}
                        className="flex-1 bg-transparent outline-none text-sm placeholder:text-zinc-600"
                    />
                    <kbd className="hl-mono text-[10px] text-zinc-500 border border-zinc-800 rounded px-1.5 py-0.5">ESC</kbd>
                </div>
                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {!q.trim() && (
                        <div className="px-3 py-8 text-center text-sm text-zinc-500">
                            <div className="flex items-center justify-center gap-2 text-zinc-600 mb-2">
                                <Command className="h-4 w-4" /><span className="hl-mono text-[11px] uppercase tracking-widest">{t("search.tip")}</span>
                            </div>
                            {t("search.tip_desc")}
                        </div>
                    )}
                    {q.trim() && (
                        <>
                            <Section title={t("search.section.jobs")} items={res.jobs} render={(j) => (
                                <button data-testid={`search-job-${j.id}`} key={j.id} onClick={() => go(`/jobs/${j.id}`)} className="w-full text-left px-3 py-2 rounded-md hover:bg-[var(--hl-elevated)] flex items-center gap-3">
                                    <span className="hl-mono text-[10px] text-emerald-400/80 w-16 truncate">{j.code}</span>
                                    <span className="text-sm text-zinc-200 truncate flex-1">{j.title}</span>
                                    <span className="text-[10px] text-zinc-500">{j.status}</span>
                                </button>
                            )} />
                            <Section title={t("search.section.clients")} items={res.clients} render={(c) => (
                                <button data-testid={`search-client-${c.id}`} key={c.id} onClick={() => go(`/clients/${c.id}`)} className="w-full text-left px-3 py-2 rounded-md hover:bg-[var(--hl-elevated)]">
                                    <div className="text-sm text-zinc-200">{c.full_name}</div>
                                    <div className="text-[11px] text-zinc-500">{c.email || c.phone || "—"}</div>
                                </button>
                            )} />
                            <Section title={t("search.section.devices")} items={res.devices} render={(d) => (
                                <button data-testid={`search-device-${d.id}`} key={d.id} onClick={() => go(`/devices/${d.id}`)} className="w-full text-left px-3 py-2 rounded-md hover:bg-[var(--hl-elevated)]">
                                    <div className="text-sm text-zinc-200">{d.name}</div>
                                    <div className="text-[11px] text-zinc-500 hl-mono">{d.brand} {d.model} · {d.device_type}</div>
                                </button>
                            )} />
                            {!res.jobs?.length && !res.clients?.length && !res.devices?.length && (
                                <div className="px-3 py-8 text-center text-sm text-zinc-500">{t("common.no_results")}</div>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function Section({ title, items, render }) {
    if (!items?.length) return null;
    return (
        <div className="mb-2">
            <div className="px-3 py-1 hl-mono text-[10px] uppercase tracking-widest text-zinc-600">{title}</div>
            <div>{items.map(render)}</div>
        </div>
    );
}

function TopBar({ onSearch }) {
    const navigate = useNavigate();
    const t = useT();
    return (
        <header className="hl-glass sticky top-0 z-30 px-6 py-3.5 flex items-center gap-3">
            <button data-testid="topbar-search-btn" onClick={onSearch} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-200 transition-colors px-3 py-2 rounded-lg border border-[var(--hl-border)] bg-[var(--hl-card)] hover:bg-[var(--hl-card-hover)] w-72">
                <Search className="h-4 w-4" />
                <span>{t("topbar.search_placeholder")}</span>
                <kbd className="ml-auto hl-mono text-[10px] text-zinc-500 border border-zinc-800 rounded px-1.5 py-0.5">⌘K</kbd>
            </button>
            <div className="flex-1" />
            <Button data-testid="topbar-new-client" size="sm" variant="outline" className="border-[var(--hl-border)] bg-[var(--hl-card)] hover:bg-[var(--hl-elevated)]" onClick={() => navigate("/clients/new")}>
                <Plus className="h-3.5 w-3.5 mr-1" /> {t("topbar.new_client")}
            </Button>
            <Button data-testid="topbar-new-device" size="sm" variant="outline" className="border-[var(--hl-border)] bg-[var(--hl-card)] hover:bg-[var(--hl-elevated)]" onClick={() => navigate("/devices/new")}>
                <Plus className="h-3.5 w-3.5 mr-1" /> {t("topbar.new_device")}
            </Button>
            <Button data-testid="topbar-new-job" size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium" onClick={() => navigate("/jobs/new")}>
                <Plus className="h-3.5 w-3.5 mr-1" /> {t("topbar.new_job")}
            </Button>
        </header>
    );
}

export default function AppShell({ children }) {
    const [searchOpen, setSearchOpen] = useState(false);

    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setSearchOpen((v) => !v);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
        <div className="App flex min-h-screen bg-[var(--hl-bg)]">
            <Sidebar />
            <div className="flex-1 min-w-0 flex flex-col">
                <TopBar onSearch={() => setSearchOpen(true)} />
                <MustChangePasswordBanner />
                <main className="flex-1 px-6 lg:px-10 py-8 max-w-[1600px] w-full mx-auto">
                    {children}
                </main>
            </div>
            <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </div>
    );
}
