import { z } from "zod";

/** Custom alias / auto-generated short code shape shared by Zod validation and DB constraints. */
export const SHORT_CODE_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;

/** Default length for auto-generated short codes (nanoid, url-safe alphabet). */
export const DEFAULT_SHORT_CODE_LENGTH = 7;
export const MIN_SHORT_CODE_LENGTH = 4;
export const MAX_SHORT_CODE_LENGTH = 16;

export const shortCodeSchema = z
  .string()
  .regex(SHORT_CODE_PATTERN, "Short code must be 3-32 chars: letters, digits, _ or -");

export const shortCodeLengthSchema = z
  .number()
  .int()
  .min(MIN_SHORT_CODE_LENGTH)
  .max(MAX_SHORT_CODE_LENGTH)
  .default(DEFAULT_SHORT_CODE_LENGTH);
