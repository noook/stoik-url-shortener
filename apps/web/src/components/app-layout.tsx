import { Link, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import LogOutIcon from "~icons/lucide/log-out";

export function AppLayout() {
  const { session, logout } = useAuth();

  return (
    <div className="min-h-svh flex flex-col">
      <header className="border-b px-6 py-3 flex items-center justify-between">
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
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
