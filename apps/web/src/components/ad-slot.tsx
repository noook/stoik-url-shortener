import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

interface AdSlotProps {
  /** Requested creative width, in px - forwarded to GET /api/ads. */
  width: number;
  /** Requested creative height, in px - forwarded to GET /api/ads. */
  height: number;
  className?: string;
}

/**
 * A single ad slot. Fetches through our own API (GET /api/ads), which
 * proxies a third-party ad service server-side so its private auth token
 * never reaches the browser - see apps/api/src/ads. Homepage-only; used by
 * LinksListPage for the vertical side-rail and horizontal footer slots
 * (see plan §3.5) - not placed in AppLayout, which every authenticated
 * page shares.
 *
 * Fails open: no ad, no error UI, no broken layout - ads are decorative,
 * never allowed to block or clutter the page. `retry: false` since a
 * failed ad fetch is expected to happen sometimes (upstream token/quota
 * issues) and retrying wouldn't change the fact this render just skips it.
 */
export function AdSlot({ width, height, className }: AdSlotProps) {
  const { data: ad } = useQuery({
    queryKey: ["ad", width, height],
    queryFn: () => api.ads.get({ width, height }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (!ad) return null;

  return (
    <a
      href={ad.link}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={className}
      aria-label="Advertisement"
    >
      <img
        src={ad.imageUrl}
        alt="Advertisement"
        width={ad.width}
        height={ad.height}
        className="h-auto max-w-full rounded-lg border"
      />
    </a>
  );
}
