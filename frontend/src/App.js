import { Routes, Route, Navigate, BrowserRouter, useLocation, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";
import "./index.css";
import "./App.css";

import LoginPage from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import JobsList from "./pages/JobsList";
import JobNewEdit from "./pages/JobNewEdit";
import JobDetail from "./pages/JobDetail";
import ClientsList from "./pages/ClientsList";
import ClientDetail from "./pages/ClientDetail";
import DevicesList from "./pages/DevicesList";
import DeviceDetail from "./pages/DeviceDetail";
import FinancePage from "./pages/Finance";
import TemplatesPage from "./pages/Templates";
import SettingsPage from "./pages/Settings";
import AppShell from "./components/houston/AppShell";

function ProtectedShell() {
    const { user, loading } = useAuth();
    const loc = useLocation();
    if (loading || user === undefined) {
        return <div className="min-h-screen flex items-center justify-center bg-[var(--hl-bg)] text-zinc-500 text-sm">Loading…</div>;
    }
    if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
    return (
        <AppShell>
            <Outlet />
        </AppShell>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route element={<ProtectedShell />}>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/jobs" element={<JobsList />} />
                        <Route path="/jobs/new" element={<JobNewEdit />} />
                        <Route path="/jobs/:id" element={<JobDetail />} />
                        <Route path="/jobs/:id/edit" element={<JobNewEdit />} />
                        <Route path="/clients" element={<ClientsList />} />
                        <Route path="/clients/new" element={<ClientDetail mode="new" />} />
                        <Route path="/clients/:id" element={<ClientDetail mode="view" />} />
                        <Route path="/clients/:id/edit" element={<ClientDetail mode="edit" />} />
                        <Route path="/devices" element={<DevicesList />} />
                        <Route path="/devices/new" element={<DeviceDetail mode="new" />} />
                        <Route path="/devices/:id" element={<DeviceDetail mode="view" />} />
                        <Route path="/devices/:id/edit" element={<DeviceDetail mode="edit" />} />
                        <Route path="/finance" element={<FinancePage />} />
                        <Route path="/templates" element={<TemplatesPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
            <Toaster theme="dark" position="top-right" closeButton richColors />
        </AuthProvider>
    );
}
