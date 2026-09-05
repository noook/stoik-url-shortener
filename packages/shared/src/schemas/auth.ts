import { z } from "zod";

/** POST /api/auth/session request body: the plaintext CLI-issued token, pasted once at login. */
export const createSessionSchema = z.object({
  token: z.string().min(20, "That doesn't look like a valid token"),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const sessionInfoSchema = z.object({
  tokenName: z.string(),
  authenticated: z.literal(true),
});
export type SessionInfo = z.infer<typeof sessionInfoSchema>;
