import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Save, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
    const { user, refreshUser } = useAuth();
    const [settings, setSettings] = useState(null);
    const [profile, setProfile] = useState({ name: "", email: "" });
    const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
    const [savingS, setSavingS] = useState(false);
    const [savingP, setSavingP] = useState(false);
    const [savingPwd, setSavingPwd] = useState(false);

    useEffect(() => {
        (async () => {
            const r = await api.get("/settings");
            setSettings(r.data);
        })();
    }, []);
    useEffect(() => {
        if (user) setProfile({ name: user.name || "", email: user.email || "" });
    }, [user]);

    const saveSettings = async () => {
        setSavingS(true);
        try {
            const { data } = await api.put("/settings", settings);
            setSettings(data);
            toast.success("Settings saved");
        } finally { setSavingS(false); }
    };

    const saveProfile = async () => {
        setSavingP(true);
        try {
            await api.post("/auth/profile", profile);
            await refreshUser();
            toast.success("Profile updated");
        } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
        finally { setSavingP(false); }
    };

    const changePassword = async () => {
        if (pwd.next !== pwd.confirm) { toast.error("Passwords don't match"); return; }
        setSavingPwd(true);
        try {
            await api.post("/auth/change-password", { current_password: pwd.current, new_password: pwd.next });
            setPwd({ current: "", next: "", confirm: "" });
            toast.success("Password changed");
        } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
        finally { setSavingPwd(false); }
    };

    if (!settings || !user) return <div className="text-zinc-500 text-sm">Loading…</div>;

    return (
        <div className="space-y-7 hl-fade-up max-w-3xl">
            <div>
                <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1.5">// Configuration</div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">Settings</h1>
            </div>

            <div className="hl-card p-6 space-y-5">
                <div className="text-base font-medium text-white">Brand</div>
                <Field label="Brand name"><Input data-testid="settings-brand-name" value={settings.brand_name} onChange={(e) => setSettings({ ...settings, brand_name: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Accent color">
                        <div className="flex gap-3 items-center">
                            <input type="color" value={settings.accent_color} onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })} className="h-10 w-14 rounded-md bg-transparent border border-[var(--hl-border)]" />
                            <Input value={settings.accent_color} onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)] hl-mono" />
                        </div>
                    </Field>
                    <Field label="Currency"><Input data-testid="settings-currency" value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                </div>
                <Field label="Logo URL (optional)"><Input value={settings.logo_url || ""} onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                <div className="flex justify-end">
                    <Button data-testid="settings-save-btn" onClick={saveSettings} disabled={savingS} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 gap-2">
                        {savingS ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                    </Button>
                </div>
            </div>

            <div className="hl-card p-6 space-y-5">
                <div className="text-base font-medium text-white">Admin profile</div>
                <Field label="Username"><Input value={user.username} disabled className="bg-[var(--hl-input)] border-[var(--hl-border)] opacity-60" /></Field>
                <Field label="Display name"><Input data-testid="profile-name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                <Field label="Email"><Input data-testid="profile-email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                <div className="flex justify-end">
                    <Button data-testid="profile-save-btn" onClick={saveProfile} disabled={savingP} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 gap-2">
                        {savingP ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
                    </Button>
                </div>
            </div>

            <div className="hl-card p-6 space-y-5">
                <div className="flex items-center gap-2 text-base font-medium text-white"><Lock className="h-4 w-4 text-emerald-400" />Change password</div>
                <Field label="Current password"><Input data-testid="pwd-current" type="password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="New password"><Input data-testid="pwd-new" type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                    <Field label="Confirm new"><Input data-testid="pwd-confirm" type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                </div>
                <div className="flex justify-end">
                    <Button data-testid="pwd-save-btn" onClick={changePassword} disabled={savingPwd} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 gap-2">
                        {savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Update password
                    </Button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div className="space-y-2">
            <Label className="text-xs hl-mono uppercase tracking-widest text-zinc-500">{label}</Label>
            {children}
        </div>
    );
}
