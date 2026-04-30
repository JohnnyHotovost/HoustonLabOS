import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(undefined); // undefined = loading
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const { data } = await api.get("/auth/me");
            setUser(data);
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const login = async (identifier, password, remember) => {
        const { data } = await api.post("/auth/login", { identifier, password, remember });
        if (data.token) localStorage.setItem("hl_token", data.token);
        setUser(data.user);
        return data.user;
    };

    const logout = async () => {
        try { await api.post("/auth/logout"); } catch { /* noop */ }
        localStorage.removeItem("hl_token");
        setUser(null);
    };

    const refreshUser = load;

    return (
        <AuthCtx.Provider value={{ user, loading, login, logout, refreshUser }}>
            {children}
        </AuthCtx.Provider>
    );
}

export const useAuth = () => useContext(AuthCtx);
