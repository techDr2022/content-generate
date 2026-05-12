import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { DashboardPage } from "@/pages/Dashboard";
import { ClientsPage } from "@/pages/Clients";
import { GeneratorPage } from "@/pages/Generator";
import { BulkExportPage } from "@/pages/BulkExport";
import { JobHistoryPage } from "@/pages/JobHistory";
import { ImageStudioPage } from "@/pages/ImageStudio";
import { SettingsPage } from "@/pages/Settings";
import { LoginPage } from "@/pages/Login";
import { useMemo } from "react";

function ProtectedLayout(): JSX.Element {
  const token = localStorage.getItem("token");
  const user = useMemo(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { name: string };
    } catch {
      return null;
    }
  }, []);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header userName={user?.name} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/generator" element={<GeneratorPage />} />
        <Route path="/poster-images" element={<ImageStudioPage />} />
        <Route path="/bulk-export" element={<BulkExportPage />} />
        <Route path="/jobs" element={<JobHistoryPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
