import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { RequireAuth } from "@/components/require-auth";
import { AppLayout } from "@/components/app-layout";
import { LoginPage } from "@/pages/login-page";
import { LinksListPage } from "@/pages/links-list-page";
import { LinkDetailPage } from "@/pages/link-detail-page";
import { CreateLinkPage } from "@/pages/create-link-page";
import { Toaster } from "@/components/ui/sonner";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Dashboard lives under /admin on this domain - keep in sync with
          vite.config.ts's `base` and docker-compose.yml's `web` router. */}
      <BrowserRouter basename="/admin">
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<LinksListPage />} />
                <Route path="/links/new" element={<CreateLinkPage />} />
                <Route path="/links/:id" element={<LinkDetailPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}
