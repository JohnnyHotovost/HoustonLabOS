import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useT } from "../i18n/I18nContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { ZapIcon, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
    const { user, login } = useAuth();
    const t = useT();
    const navigate = useNavigate();
    const [identifier, setIdentifier] = useState("admin");
    const [password, setPassword] = useState("");
    const [remember, setRemember] = useState(true);
    const [loading, setLoading] = useState(false);

    if (user === undefined) return null;
    if (user) return <Navigate to="/" replace />;

    const onSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(identifier, password, remember);
            navigate("/");
        } catch (err) {
            const detail = err?.response?.data?.detail;
            const msg = typeof detail === "string" ? detail : t("login.failed");
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-[var(--hl-bg)]">
            {/* Left: form */}
            <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
                <div className="absolute inset-0 hl-grid-bg opacity-40 pointer-events-none" />
                <div className="absolute -top-1/3 -left-1/3 w-[60vw] h-[60vw] rounded-full bg-emerald-500/[0.04] blur-3xl pointer-events-none" />
                <form data-testid="login-form" onSubmit={onSubmit} className="relative w-full max-w-md hl-fade-up">
                    <div className="flex items-center gap-2.5 mb-10">
                        <div className="relative h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/30 flex items-center justify-center">
                            <ZapIcon className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <div className="text-base font-semibold tracking-tight">HoustonLab OS</div>
                            <div className="text-[10px] hl-mono uppercase tracking-widest text-zinc-500">{t("login.tag")}</div>
                        </div>
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-2">{t("login.title")}</h1>
                    <p className="text-sm text-zinc-500 mb-8">{t("login.subtitle")}</p>

                    <div className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="identifier" className="text-xs hl-mono uppercase tracking-widest text-zinc-500">{t("login.identifier")}</Label>
                            <Input id="identifier" data-testid="login-identifier-input" autoFocus
                                value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                                className="bg-[var(--hl-card)] border-[var(--hl-border)] h-11" placeholder="admin" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-xs hl-mono uppercase tracking-widest text-zinc-500">{t("login.password")}</Label>
                            <Input id="password" data-testid="login-password-input" type="password"
                                value={password} onChange={(e) => setPassword(e.target.value)}
                                className="bg-[var(--hl-card)] border-[var(--hl-border)] h-11" placeholder="••••••••" />
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                                <Checkbox data-testid="login-remember-checkbox" checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
                                {t("login.remember")}
                            </label>
                            <span className="text-xs text-zinc-600 hl-mono">v1.0</span>
                        </div>
                        <Button type="submit" data-testid="login-submit-btn" disabled={loading}
                            className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium gap-2">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                            {t("login.submit")}
                        </Button>
                    </div>

                    <div className="mt-10 text-[11px] text-zinc-600 hl-mono leading-relaxed">
                        {t("login.tip_change")}
                    </div>
                </form>
            </div>

            {/* Right: frosted access-required visual */}
            <div className="hidden lg:block flex-1 relative overflow-hidden border-l border-[var(--hl-border)]">
                {/* Lightly blurred background image — readable but cinematic */}
                <div
                    className="absolute inset-0 bg-cover bg-center scale-110"
                    style={{
                        backgroundImage: "url('https://images.unsplash.com/photo-1769002240965-7cc4b129d81a?crop=entropy&cs=srgb&fm=jpg&q=85')",
                        filter: "blur(8px) saturate(0.95) brightness(0.7)",
                    }}
                />
                {/* Dark cinematic overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--hl-bg)]/80 via-black/50 to-emerald-950/30" />
                {/* Subtle green "lab glow" */}
                <div className="absolute -top-1/4 -right-1/4 w-[70vh] h-[70vh] rounded-full bg-emerald-500/10 blur-[160px]" />
                <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
                {/* Thin grid for technical texture */}
                <div className="absolute inset-0 hl-grid-bg opacity-25" />
                {/* Tagline */}
                <div className="absolute bottom-12 left-12 right-12">
                    <div className="hl-mono text-[10px] uppercase tracking-widest text-emerald-400/80 mb-3">{t("login.kicker")}</div>
                    <div className="text-3xl font-semibold tracking-tight text-white max-w-md leading-tight">
                        {t("login.hero_title_pre")} <span className="text-emerald-400">{t("login.hero_title_accent")}</span> {t("login.hero_title_post")}
                    </div>
                    <div className="text-sm text-zinc-400 mt-3 max-w-md">
                        {t("login.hero_sub")}
                    </div>
                </div>
            </div>
        </div>
    );
}
