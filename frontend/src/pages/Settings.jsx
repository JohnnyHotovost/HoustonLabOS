import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useI18n, useT, LANGUAGES } from "../i18n/I18nContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Save, Loader2, Lock, Globe, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
    const { user, refreshUser } = useAuth();
    const { lang, setLang } = useI18n();
    const t = useT();
    const [settings, setSettings] = useState(null);
    const [profile, setProfile] = useState({ username: "", name: "", email: "" });
    const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
    const [savingS, setSavingS] = useState(false);
    const [savingP, setSavingP] = useState(false);
    const [savingPwd, setSavingPwd] = useState(false);
    const pwdRef = useRef(null);
    const location = useLocation();

    useEffect(() => {
        if (location.hash === "#change-password" && pwdRef.current) {
            // give the page a tick to render
            setTimeout(() => pwdRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
        }
    }, [location.hash, settings, user]);

    useEffect(() => {
        (async () => {
            const r = await api.get("/settings");
            setSettings({ language: "en", ...r.data });
        })();
    }, []);
    useEffect(() => {
        if (user) setProfile({ username: user.username || "", name: user.name || "", email: user.email || "" });
    }, [user]);

    const saveSettings = async () => {
        setSavingS(true);
        try {
            const { data } = await api.put("/settings", settings);
            setSettings({ language: "en", ...data });
            if (settings.language) setLang(settings.language);
            toast.success(t("settings.saved"));
        } finally { setSavingS(false); }
    };

    const saveProfile = async () => {
        setSavingP(true);
        try {
            await api.post("/auth/profile", profile);
            await refreshUser();
            toast.success(t("settings.profile_saved"));
        } catch (e) { toast.error(e?.response?.data?.detail || t("settings.failed")); }
        finally { setSavingP(false); }
    };

    const changePassword = async () => {
        if (pwd.next !== pwd.confirm) { toast.error(t("settings.pwd_mismatch")); return; }
        setSavingPwd(true);
        try {
            await api.post("/auth/change-password", { current_password: pwd.current, new_password: pwd.next });
            setPwd({ current: "", next: "", confirm: "" });
            toast.success(t("settings.pwd_changed"));
            await refreshUser();
        } catch (e) { toast.error(e?.response?.data?.detail || t("settings.failed")); }
        finally { setSavingPwd(false); }
    };

    const onLanguageChange = (code) => {
        setSettings({ ...settings, language: code });
        setLang(code); // immediate UI switch for preview
    };

    if (!settings || !user) return <div className="text-zinc-500 text-sm">{t("common.loading")}</div>;

    return (
        <div className="space-y-7 hl-fade-up max-w-3xl mx-auto w-full">
            <div>
                <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-1.5">// {t("settings.kicker")}</div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">{t("settings.title")}</h1>
            </div>

            <div className="hl-card p-6 space-y-5">
                <div className="flex items-center gap-2 text-base font-medium text-white"><Globe className="h-4 w-4 text-emerald-400" />{t("settings.language")}</div>
                <Field label={t("settings.language")}>
                    <Select value={settings.language || lang} onValueChange={onLanguageChange}>
                        <SelectTrigger data-testid="settings-language" className="bg-[var(--hl-input)] border-[var(--hl-border)]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </Field>
            </div>

            <div className="hl-card p-6 space-y-5">
                <div className="text-base font-medium text-white">{t("settings.brand")}</div>
                <Field label={t("settings.brand_name")}><Input data-testid="settings-brand-name" value={settings.brand_name || ""} onChange={(e) => setSettings({ ...settings, brand_name: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label={t("settings.accent_color")}>
                        <div className="flex gap-3 items-center">
                            <input type="color" value={settings.accent_color || "#34D399"} onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })} className="h-10 w-14 rounded-md bg-transparent border border-[var(--hl-border)]" />
                            <Input value={settings.accent_color || ""} onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)] hl-mono" />
                        </div>
                    </Field>
                    <Field label={t("settings.currency")}><Input data-testid="settings-currency" value={settings.currency || ""} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                </div>
                <Field label={t("settings.logo_url")}><Input value={settings.logo_url || ""} onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                <div className="flex justify-end">
                    <Button data-testid="settings-save-btn" onClick={saveSettings} disabled={savingS} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 gap-2">
                        {savingS ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t("common.save")}
                    </Button>
                </div>
            </div>

            <div className="hl-card p-6 space-y-5">
                <div className="text-base font-medium text-white">{t("settings.profile")}</div>
                <Field label={t("settings.username")}>
                    <Input data-testid="profile-username" value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" />
                </Field>
                <Field label={t("settings.display_name")}><Input data-testid="profile-name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                <Field label={t("settings.email")}><Input data-testid="profile-email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                <div className="flex justify-end">
                    <Button data-testid="profile-save-btn" onClick={saveProfile} disabled={savingP} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 gap-2">
                        {savingP ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t("common.save")}
                    </Button>
                </div>
            </div>

            <div ref={pwdRef} id="change-password" className={`hl-card p-6 space-y-5 ${user?.must_change_password ? "border-red-500/30 ring-1 ring-red-500/20" : ""}`}>
                {user?.must_change_password && (
                    <div data-testid="settings-pwd-force-notice" className="flex items-start gap-3 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-200 text-sm">
                        <ShieldAlert className="h-4 w-4 text-red-300 mt-0.5 shrink-0" />
                        <div>
                            <div className="font-medium">{t("pwd_force.title")}</div>
                            <div className="text-red-300/80 text-xs mt-0.5">{t("pwd_force.subtitle")}</div>
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-2 text-base font-medium text-white"><Lock className="h-4 w-4 text-emerald-400" />{t("settings.change_password")}</div>
                <Field label={t("settings.pwd.current")}><Input data-testid="pwd-current" type="password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label={t("settings.pwd.new")}><Input data-testid="pwd-new" type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                    <Field label={t("settings.pwd.confirm")}><Input data-testid="pwd-confirm" type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} className="bg-[var(--hl-input)] border-[var(--hl-border)]" /></Field>
                </div>
                <div className="flex justify-end">
                    <Button data-testid="pwd-save-btn" onClick={changePassword} disabled={savingPwd} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 gap-2">
                        {savingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t("settings.pwd.update")}
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
