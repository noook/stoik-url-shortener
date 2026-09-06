import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import type { Link, LinkPage, LinkStatus } from "@url-shortener/shared";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PlusIcon from "~icons/lucide/plus";
import ChevronLeftIcon from "~icons/lucide/chevron-left";
import ChevronRightIcon from "~icons/lucide/chevron-right";
import CopyIcon from "~icons/lucide/copy";
import CheckIcon from "~icons/lucide/check";
import { toast } from "sonner";

const PAGE_SIZE = 20;

const STATUS_BADGE: Record<LinkStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  active: { label: "Active", variant: "default" },
  scheduled: { label: "Scheduled", variant: "outline" },
  expired: { label: "Expired", variant: "secondary" },
  inactive: { label: "Inactive", variant: "destructive" },
};

export function LinksListPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["links", page],
    queryFn: () =>
      api<LinkPage>("/links", { query: { page, pageSize: PAGE_SIZE } }),
    placeholderData: (previous) => previous,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-medium">Links</h1>
        <Button asChild size="sm">
          <RouterLink to="/links/new">
            <PlusIcon className="size-4" />
            Create link
          </RouterLink>
        </Button>
      </div>

      {isError && <p className="text-sm text-destructive">Couldn't load links.</p>}

      {!isError && (
        <>
          <div className="rounded-lg border">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[22%]">Name</TableHead>
                  <TableHead className="w-[20%]">Short link</TableHead>
                  <TableHead className="w-[32%]">Destination</TableHead>
                  <TableHead className="w-[14%]">Status</TableHead>
                  <TableHead className="w-[12%] text-right">Clicks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && !data && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {data?.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No links yet.
                    </TableCell>
                  </TableRow>
                )}
                {data?.items.map((link) => (
                  <LinkRow key={link.id} link={link} />
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {data ? `${data.total} link${data.total === 1 ? "" : "s"}` : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LinkRow({ link }: { link: Link }) {
  const badge = STATUS_BADGE[link.status];
  const shortUrl = `${link.domainHostname}/${link.shortCode}`;
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    toast.success("Short link copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <TableRow className="group/row">
      <TableCell className="truncate">
        <RouterLink to={`/links/${link.id}`} className="block truncate font-medium hover:underline">
          {link.name}
        </RouterLink>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate">{shortUrl}</span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy short link"
            className="shrink-0 rounded p-0.5 opacity-0 transition-opacity duration-500 hover:bg-muted group-hover/row:opacity-100"
          >
            {copied ? (
              <CheckIcon className="size-3.5 text-foreground" />
            ) : (
              <CopyIcon className="size-3.5" />
            )}
          </button>
        </div>
      </TableCell>
      <TableCell className="truncate text-muted-foreground">
        {link.destinationUrl}
      </TableCell>
      <TableCell>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </TableCell>
      <TableCell className="text-right">{link.clickCount}</TableCell>
    </TableRow>
  );
}
