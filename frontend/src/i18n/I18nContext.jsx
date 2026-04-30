import { createContext, useContext, useEffect, useState, useCallback } from "react";
import en from "./en";
import cs from "./cs";
import api from "../lib/api";

const DICTS = { en, cs };
export const LANGUAGES = [
    { code: "en", label: "English" },
    { code: "cs", label: "Čeština" },
];

const I18nCtx = createContext(null);

function interpolate(str, vars) {
    if (!str) return "";
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }) {
    const [lang, setLangState] = useState(() => {
        try {
            return localStorage.getItem("hl_lang") || "en";
        } catch {
            return "en";
        }
    });

    // Try to sync with backend settings once; failure is non-fatal (e.g. not logged in yet).
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await api.get("/settings");
                if (cancelled) return;
                if (data?.language && DICTS[data.language]) {
                    setLangState(data.language);
                    localStorage.setItem("hl_lang", data.language);
                }
            } catch { /* not authenticated yet — keep local */ }
        })();
        return () => { cancelled = true; };
    }, []);

    const setLang = useCallback((code) => {
        if (!DICTS[code]) return;
        setLangState(code);
        try { localStorage.setItem("hl_lang", code); } catch { /* noop */ }
    }, []);

    const t = useCallback((key, vars) => {
        const dict = DICTS[lang] || DICTS.en;
        const str = dict[key] ?? DICTS.en[key] ?? key;
        return interpolate(str, vars);
    }, [lang]);

    return (
        <I18nCtx.Provider value={{ lang, setLang, t, languages: LANGUAGES }}>
            {children}
        </I18nCtx.Provider>
    );
}

export const useI18n = () => useContext(I18nCtx);
export const useT = () => useContext(I18nCtx).t;
