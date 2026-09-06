import { z } from "zod";

export const clickEventSchema = z.object({
  id: z.uuid(),
  linkId: z.uuid(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  referrer: z.string().nullable(),
  occurredAt: z.coerce.date(),
});
export type ClickEvent = z.infer<typeof clickEventSchema>;

/**
 * Matches the actual `GET /links/:id/clicks` response shape
 * (`ClickEventsService.listForLink`) - no `total`, since the click log's
 * pagination is prev/next-only (see link-detail-page.tsx's `ClickLogTable`).
 */
export const clickEventPageSchema = z.object({
  items: z.array(clickEventSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type ClickEventPage = z.infer<typeof clickEventPageSchema>;
