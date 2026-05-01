import { useEffect, useState } from "react";
import api from "../lib/api";
import { useT } from "../i18n/I18nContext";
import { useAuth } from "../context/AuthContext";
import { fmtDateTime, fmtRelative } from "../lib/format";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Plus, Pencil, KeyRound, Trash2, Loader2, ShieldCheck, ShieldAlert, Eye } from "lucide-react";
import { toast } from "sonner";

const ROLES = ["admin", "collaborator", "spectator"];

function RoleBadge({ role }) {
    const map = {
        admin:        { icon: ShieldCheck,  klass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
        collaborator: { icon: ShieldAlert,  klass: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30" },
        spectator:    { icon: Eye,          klass: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30" },
    };
    const { icon: Icon, klass } = map[role] || map.spectator;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] hl-mono uppercase tracking-widest border ${klass}`}>
            <Icon className="h-3 w-3" /> {role}
        </span>
    );
}

export default function UsersPage() {
    const t = useT();
    const { user: me } = useAuth();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null); // user object or { _new: true }
    const [resetting, setResetting] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);

    const load = async () => {
        setLoading(true);
        try {
            const r = await api.get("/users");
            setRows(r.data || []);
        } finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    if (me?.role !== "admin") {
        return <div className="hl-card p-6 text-sm text-zinc-400">Admin role required.</div>;
    }

    return (
        <div className="space-y-6 hl-fade-up">
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1.5">{t("users.kicker")}</div>
                    <h1 className="text-3xl font-semibold tracking-tight text-white">{t("users.title")}</h1>
                    <p className="text-sm text-zinc-500 mt-1">{t("users.subtitle")}</p>
                </div>
                <Button data-testid="users-add-btn" onClick={() => setEditing({ _new: true, role: "collaborator", is_active: true })}
                    className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 gap-2">
                    <Plus className="h-4 w-4" /> {t("users.add")}
                </Button>
            </div>

            <div className="hl-card overflow-hidden" data-testid="users-table">
                <table className="min-w-full text-sm">
                    <thead className="border-b border-[var(--hl-border-subtle)]">
                        <tr className="text-left">
                            {["user", "email", "role", "status", "last_login", "created", "actions"].map((c) => (
                                <th key={c} className="px-5 py-3 hl-mono text-[10px] uppercase tracking-widest text-zinc-500">
                                    {t(`users.col.${c}`)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td colSpan={7} className="px-5 py-8 text-center text-zinc-500">…</td></tr>}
                        {!loading && rows.map((u) => (
                            <tr key={u.id} data-testid={`user-row-${u.id}`} className="border-b border-[var(--hl-border-subtle)] last:border-0 hover:bg-[var(--hl-elevated)]/50">
                                <td className="px-5 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-7 w-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300 text-[11px] hl-mono">
                                            {(u.name || u.username || "?").slice(0, 1).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-zinc-200">{u.username}{me?.id === u.id && <span className="ml-2 text-[10px] hl-mono text-emerald-400/80">{`// you`}</span>}</div>
                                            {u.name && <div className="text-[11px] text-zinc-500">{u.name}</div>}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-5 py-3 hl-mono text-xs text-zinc-300">{u.email}</td>
                                <td className="px-5 py-3"><RoleBadge role={u.role} /></td>
                                <td className="px-5 py-3">
                                    <span className={`hl-mono text-[10px] uppercase tracking-widest ${u.is_active === false ? "text-red-300" : "text-emerald-300"}`}>
                                        {u.is_active === false ? t("users.status.inactive") : t("users.status.active")}
                                    </span>
                                </td>
                                <td className="px-5 py-3 hl-mono text-xs text-zinc-400">
                                    {u.last_login_at ? fmtRelative(u.last_login_at) : t("users.never")}
                                </td>
                                <td className="px-5 py-3 hl-mono text-xs text-zinc-500">{fmtDateTime(u.created_at)}</td>
                                <td className="px-5 py-3">
                                    <div className="flex gap-1">
                                        <Button data-testid={`user-edit-${u.id}`} variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(u)}>
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button data-testid={`user-reset-${u.id}`} variant="ghost" size="icon" className="h-7 w-7" onClick={() => setResetting(u)}>
                                            <KeyRound className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button data-testid={`user-delete-${u.id}`} variant="ghost" size="icon" className="h-7 w-7 text-red-300 hover:text-red-200"
                                            disabled={u.id === me?.id} onClick={() => setConfirmDelete(u)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editing && (
                <UserDialog
                    user={editing}
                    onClose={() => setEditing(null)}
                    onSaved={async () => { setEditing(null); await load(); }}
                />
            )}
            {resetting && (
                <ResetPasswordDialog
                    user={resetting}
                    onClose={() => setResetting(null)}
                    onDone={() => { setResetting(null); toast.success(t("settings.pwd_changed") || "Password reset"); }}
                />
            )}
            {confirmDelete && (
                <DeleteUserDialog
                    user={confirmDelete}
                    onClose={() => setConfirmDelete(null)}
                    onDone={async () => { setConfirmDelete(null); await load(); }}
                />
            )}
        </div>
    );
}

function UserDialog({ user, onClose, onSaved }) {
    const t = useT();
    const isNew = !!user._new;
    const [form, setForm] = useState({
        username: user.username || "",
        email: user.email || "",
        name: user.name || "",
        role: user.role || "collaborator",
        is_active: user.is_active !== false,
        password: "",
    });
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        setBusy(true);
        try {
            if (isNew) {
                await api.post("/users", { ...form });
                toast.success("User created");
            } else {
                const update = {
                    username: form.username,
                    email: form.email,
                    name: form.name,
                    role: form.role,
                    is_active: form.is_active,
                };
                await api.put(`/users/${user.id}`, update);
                toast.success("User updated");
            }
            await onSaved();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Failed");
        } finally { setBusy(false); }
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent data-testid="user-dialog" className="bg-[var(--hl-card)] border-[var(--hl-border)] sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isNew ? t("users.create.title") : t("users.edit.title")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">{t("users.username")}</Label>
                            <Input data-testid="user-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">{t("users.email")}</Label>
                            <Input data-testid="user-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">{t("users.name")}</Label>
                        <Input data-testid="user-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">{t("users.role")}</Label>
                        <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                            <SelectTrigger data-testid="user-role" className="bg-[var(--hl-input)] border-[var(--hl-border)]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {ROLES.map((r) => (
                                    <SelectItem key={r} value={r} data-testid={`user-role-opt-${r}`}>
                                        <div className="flex flex-col">
                                            <span className="capitalize">{t(`users.role.${r}`)}</span>
                                            <span className="text-[10px] text-zinc-500">{t(`users.role.${r}_desc`)}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {isNew && (
                        <div className="space-y-1.5">
                            <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">{t("users.password")}</Label>
                            <Input data-testid="user-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" />
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                        <Switch data-testid="user-active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                        <Label className="text-sm text-zinc-300">{t("users.is_active")}</Label>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>{t("users.cancel")}</Button>
                    <Button data-testid="user-save" onClick={submit} disabled={busy} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 gap-2">
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isNew ? t("users.create") : t("users.save")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ResetPasswordDialog({ user, onClose, onDone }) {
    const t = useT();
    const [pwd, setPwd] = useState("");
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        setBusy(true);
        try {
            await api.post(`/users/${user.id}/reset-password`, { new_password: pwd });
            onDone();
        } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
        finally { setBusy(false); }
    };
    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent data-testid="user-reset-dialog" className="bg-[var(--hl-card)] border-[var(--hl-border)] sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t("users.reset_pwd_title")}</DialogTitle>
                    <DialogDescription className="text-zinc-500">@{user.username}</DialogDescription>
                </DialogHeader>
                <Input data-testid="user-reset-pwd" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className="bg-[var(--hl-input)] border-[var(--hl-border)]" />
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>{t("users.cancel")}</Button>
                    <Button data-testid="user-reset-confirm" onClick={submit} disabled={busy || pwd.length < 10} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 gap-2">
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t("users.save")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DeleteUserDialog({ user, onClose, onDone }) {
    const t = useT();
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        setBusy(true);
        try {
            await api.delete(`/users/${user.id}`);
            toast.success("User deleted");
            await onDone();
        } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
        finally { setBusy(false); }
    };
    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent data-testid="user-delete-dialog" className="bg-[var(--hl-card)] border-[var(--hl-border)] sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t("users.confirm_delete")}</DialogTitle>
                    <DialogDescription className="text-zinc-500">
                        @{user.username} · {t("users.confirm_delete_desc")}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>{t("users.cancel")}</Button>
                    <Button data-testid="user-delete-confirm" onClick={submit} disabled={busy} className="bg-red-500 hover:bg-red-400 text-white gap-2">
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t("users.action.delete")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
