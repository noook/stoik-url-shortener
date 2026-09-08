import { z } from "zod";

/**
 * Shared page/pageSize query params for any paginated list endpoint.
 * z.coerce turns the raw querystring values ("2") into numbers before the
 * rest of the checks run, so int/min/max operate on actual numbers - not
 * strings - the same way Number.parseInt did, but validated instead of
 * silently falling back on bad input (NaN, negative, decimal, >100 all
 * become a 400 with a clear Zod issue rather than a quietly wrong page).
 * .default() only kicks in when the param is omitted entirely.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number("page must be a number").int().min(1).default(1),
  pageSize: z.coerce.number("pageSize must be a number").int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
