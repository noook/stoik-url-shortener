import type { LinkStatus } from "./link.js";

/**
 * Single source of truth for what "active/scheduled/expired/inactive" means,
 * shared so the API and the React list/detail views never disagree about it.
 */
export function computeLinkStatus(params: {
  isActive: boolean;
  startAt: Date | null;
  endAt: Date | null;
  now?: Date;
}): LinkStatus {
  if (!params.isActive) return "inactive";
  const now = params.now ?? new Date();
  if (params.startAt && now < params.startAt) return "scheduled";
  if (params.endAt && now > params.endAt) return "expired";
  return "active";
}
