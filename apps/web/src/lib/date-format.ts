/**
 * Date formatting helpers built on `Intl.DateTimeFormat` rather than the
 * `Date` object's own locale-agnostic getters (`getFullYear`/`getMonth`/...)
 * or its locale-dependent-but-unconfigurable `toLocaleString()` - `Intl` is
 * the platform's actual internationalization API and lets formatting stay
 * consistent and explicit rather than silently following whatever the
 * runtime's default locale happens to be.
 */

/** Shared formatter for displaying a timestamp (e.g. the click log). Explicit locale + options rather than relying on defaults. */
const displayDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return displayDateTimeFormatter.format(d);
}

/**
 * Formatter used to pull local-time y/m/d/h/min components out of a Date,
 * via `formatToParts` rather than `getFullYear`/`getMonth`/etc. - same
 * underlying local-time values, but sourced from `Intl` instead of the
 * `Date` object's own component getters.
 */
const datetimeLocalPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Date -> "yyyy-MM-ddTHH:mm" in local time, what <input type="datetime-local"> expects.
 *  Accepts a Date or an ISO string, since the API client returns raw JSON (dates arrive
 *  as strings, not parsed through the zod schema - only the NestJS side coerces). */
export function toDatetimeLocal(date: Date | string | null): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  const parts = Object.fromEntries(
    datetimeLocalPartsFormatter.formatToParts(d).map((part) => [part.type, part.value]),
  );
  // en-CA gives yyyy-MM-dd for the date portion already; hour12: false with
  // en-CA can still emit "24" for midnight in some engines, so normalize it.
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

/** Inverse of toDatetimeLocal - "" (cleared) becomes null, a filled value becomes a Date. */
export function fromDatetimeLocal(value: string | undefined): Date | null {
  if (!value) return null;
  return new Date(value);
}
