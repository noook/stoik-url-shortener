import { Link, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import LogOutIcon from "~icons/lucide/log-out";

/**
 * Constrained content width applied consistently across the authenticated
 * shell and the login page, so the app reads coherently instead of content
 * spreading edge-to-edge on wide monitors.
 */
export const PAGE_WIDTH = "max-w-6xl";

export function AppLayout() {
  const { session, logout } = useAuth();

  return (
    <div className="min-h-svh flex flex-col">
      <header className="border-b">
        <div className={`${PAGE_WIDTH} mx-auto flex items-center justify-between px-6 py-3`}>
          <Link to="/" className="font-medium">
            URL Shortener
          </Link>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {session && <span>{session.tokenName}</span>}
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              <LogOutIcon className="size-4" />
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className={`${PAGE_WIDTH} mx-auto px-6 py-8`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
