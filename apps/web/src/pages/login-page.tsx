// TODO(pairing): build the real login screen here.
//
// What it needs to do:
// - A single input for the API token (paste from `pnpm --filter api cli token:create`)
// - On submit, call useAuth().login(token) - it already POSTs to /api/auth/session
//   and throws on a bad/revoked token (ofetch throws on non-2xx by default)
// - Show a clear error on failure, navigate to "/" on success
//
// Suggested tools already installed: react-hook-form + @hookform/resolvers/zod
// (no shared Zod schema for "just a token string" exists yet - either add one
// to packages/shared or validate inline, your call), shadcn Input/Label/Button.
export function LoginPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-lg font-medium mb-4">Log in</h1>
      <p className="text-sm text-muted-foreground">
        TODO: build the login form here.
      </p>
    </div>
  );
}
