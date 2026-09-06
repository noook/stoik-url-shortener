import { useState } from "react";
import { toast } from "sonner";
import CopyIcon from "~icons/lucide/copy";
import CheckIcon from "~icons/lucide/check";

/**
 * Hover-to-copy short link, used by the links list and the link detail page.
 *
 * `standalone` (default true) wraps the row in its own `group/copy` so
 * hovering the short link itself reveals the copy button - use this on the
 * detail page, where there's no larger hoverable row around it.
 *
 * Pass `standalone={false}` when an ancestor already owns a `group/row`
 * (e.g. `links-list-page.tsx`'s `<TableRow className="group/row">`) so the
 * whole table row's hover reveals the button, not just the short-link cell.
 */
export function ShortLinkCopy({
  shortUrl,
  standalone = true,
}: {
  shortUrl: string;
  standalone?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    toast.success("Short link copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  }

  const revealClass = standalone
    ? "opacity-0 group-hover/copy:opacity-100"
    : "opacity-0 group-hover/row:opacity-100";

  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${standalone ? "group/copy" : ""}`}>
      <span className="min-w-0 truncate">{shortUrl}</span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy short link"
        className={`shrink-0 rounded p-0.5 transition-opacity duration-500 hover:bg-muted ${revealClass}`}
      >
        {copied ? <CheckIcon className="size-3.5 text-foreground" /> : <CopyIcon className="size-3.5" />}
      </button>
    </div>
  );
}
