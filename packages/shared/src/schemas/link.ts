import { z } from "zod";
import { shortCodeSchema, shortCodeLengthSchema } from "./short-code.js";

/** Shared by the create-link form (react-hook-form + zodResolver) and the Nest ZodValidationPipe. */
export const createLinkSchema = z
  .object({
    destinationUrl: z.string().url("Must be a valid URL"),
    name: z.string().trim().min(1).max(200).optional(),
    domainId: z.string().uuid("Pick a domain"),
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional(),
  })
  .and(
    z.union([
      z.object({ alias: shortCodeSchema, autoLength: z.undefined().optional() }),
      z.object({ alias: z.undefined().optional(), autoLength: shortCodeLengthSchema.optional() }),
    ]),
  )
  .refine((data) => !data.startAt || !data.endAt || data.startAt < data.endAt, {
    message: "startAt must be before endAt",
    path: ["endAt"],
  });
export type CreateLinkInput = z.infer<typeof createLinkSchema>;

export const updateLinkSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    startAt: z.coerce.date().nullable().optional(),
    endAt: z.coerce.date().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => !data.startAt || !data.endAt || data.startAt < data.endAt, {
    message: "startAt must be before endAt",
    path: ["endAt"],
  });
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;

export const linkStatusSchema = z.enum(["active", "scheduled", "expired", "inactive"]);
export type LinkStatus = z.infer<typeof linkStatusSchema>;

export const linkSchema = z.object({
  id: z.string().uuid(),
  domainId: z.string().uuid(),
  domainHostname: z.string(),
  shortCode: shortCodeSchema,
  name: z.string(),
  destinationUrl: z.string().url(),
  startAt: z.coerce.date().nullable(),
  endAt: z.coerce.date().nullable(),
  isActive: z.boolean(),
  status: linkStatusSchema,
  createdAt: z.coerce.date(),
  clickCount: z.number().int(),
  lastClickAt: z.coerce.date().nullable(),
});
export type Link = z.infer<typeof linkSchema>;

export const linkPageSchema = z.object({
  items: z.array(linkSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type LinkPage = z.infer<typeof linkPageSchema>;

export const checkAliasQuerySchema = z.object({
  domainId: z.string().uuid(),
  alias: shortCodeSchema,
});
export const checkAliasResponseSchema = z.object({ available: z.boolean() });
