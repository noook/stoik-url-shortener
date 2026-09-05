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

export const clickEventPageSchema = z.object({
  items: z.array(clickEventSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type ClickEventPage = z.infer<typeof clickEventPageSchema>;
