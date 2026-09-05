// TODO(pairing): build the links list screen here.
//
// What it needs: paginated table (name, short code, domain, destination
// truncated, status, click count) via GET /api/links?page=&pageSize=, a link
// through to /links/:id for each row, and a "Create" button to /links/new.
//
// @tanstack/react-query is installed for the fetch/loading/pagination state -
// see api-client.ts for the shared `api` (ofetch) instance to call with.
export function LinksListPage() {
  return (
    <div>
      <h1 className="text-lg font-medium mb-4">Links</h1>
      <p className="text-sm text-muted-foreground">TODO: build the links list here.</p>
    </div>
  );
}
