import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useT } from "../../i18n/I18nContext";
import { ShieldAlert } from "lucide-react";

/**
 * Sticky banner shown across the app while the admin still uses the default
 * `ChangeMe123!` password. Backend signals this via `user.must_change_password`.
 */
export default function MustChangePasswordBanner() {
    const { user } = useAuth();
    const t = useT();

    if (!user?.must_change_password) return null;

    return (
        <div
            data-testid="must-change-password-banner"
            className="bg-red-500/10 border-b border-red-500/30 text-red-200 px-6 py-2.5 flex items-center gap-3 text-sm"
        >
            <ShieldAlert className="h-4 w-4 text-red-300 shrink-0" />
            <span className="flex-1 truncate">{t("pwd_force.banner")}</span>
            <Link
                to="/settings#change-password"
                data-testid="must-change-password-cta"
                className="hl-mono text-[11px] uppercase tracking-widest border border-red-400/40 hover:bg-red-500/20 px-3 py-1 rounded-md text-red-100"
            >
                {t("pwd_force.cta")}
            </Link>
        </div>
    );
}
