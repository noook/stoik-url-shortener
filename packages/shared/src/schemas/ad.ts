import { z } from "zod";

/**
 * Shape returned by GET /api/ads (our own API, proxying the third-party ad
 * service server-side - see apps/api/src/ads). Also used to validate the
 * upstream response before it's ever passed back to the browser, since the
 * third party's shape isn't something this app controls.
 */
export const adSchema = z.object({
  id: z.string(),
  imageUrl: z.url(),
  link: z.url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type Ad = z.infer<typeof adSchema>;

/** Query params GET /api/ads accepts - the requested creative size. */
export const adQuerySchema = z.object({
  width: z.coerce.number().int().positive(),
  height: z.coerce.number().int().positive(),
});
export type AdQuery = z.infer<typeof adQuerySchema>;
