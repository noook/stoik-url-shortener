// TODO(pairing): build the link detail screen here.
//
// What it needs: full link info via GET /api/links/:id, inline edit for
// name/dates/active (PATCH /api/links/:id), and a paginated click log via
// GET /api/links/:id/clicks (ip, user agent, referrer, timestamp).
import { useParams } from "react-router-dom";

export function LinkDetailPage() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-lg font-medium mb-4">Link detail</h1>
      <p className="text-sm text-muted-foreground">TODO: build the link detail view for {id} here.</p>
    </div>
  );
}
