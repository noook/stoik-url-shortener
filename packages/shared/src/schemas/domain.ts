import { z } from "zod";

export const domainSchema = z.object({
  id: z.uuid(),
  hostname: z.string(),
  isDefault: z.boolean(),
});
export type Domain = z.infer<typeof domainSchema>;

export const domainListResponseSchema = z.array(domainSchema);
