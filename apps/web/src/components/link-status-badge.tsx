import type { LinkStatus } from "@url-shortener/shared";
import { Badge } from "@/components/ui/badge";

export const STATUS_BADGE: Record<
  LinkStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  active: { label: "Active", variant: "default" },
  scheduled: { label: "Scheduled", variant: "outline" },
  expired: { label: "Expired", variant: "secondary" },
  inactive: { label: "Inactive", variant: "destructive" },
};

export function LinkStatusBadge({ status }: { status: LinkStatus }) {
  const badge = STATUS_BADGE[status];
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}
