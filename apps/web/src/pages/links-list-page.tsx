import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import type { Link } from "@url-shortener/shared";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { LinkStatusBadge } from "@/components/link-status-badge";
import { ShortLinkCopy } from "@/components/short-link-copy";
import { AdSlot } from "@/components/ad-slot";
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

const PAGE_SIZE = 20;

export function LinksListPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["links", page],
    queryFn: () => api.links.list({ page, pageSize: PAGE_SIZE }),
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
        // Homepage only - two slots (vertical + horizontal), see plan §3.5.
        // Side rail hidden below `lg` so it never crowds the table on
        // narrow screens; the main column stays the sole content there.
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
          <div>
            <div className="rounded-lg border">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[22%]">Label</TableHead>
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

            <footer className="mt-8 flex justify-center">
              <AdSlot width={800} height={250} />
            </footer>
          </div>

          <aside className="hidden lg:block">
            <AdSlot width={400} height={400} />
          </aside>
        </div>
      )}
    </div>
  );
}

function LinkRow({ link }: { link: Link }) {
  const shortUrl = `${link.domainHostname}/${link.shortCode}`;

  return (
    <TableRow className="group/row">
      <TableCell className="truncate">
        <RouterLink to={`/links/${link.id}`} className="block truncate font-medium hover:underline">
          {link.label}
        </RouterLink>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        <ShortLinkCopy shortUrl={shortUrl} standalone={false} />
      </TableCell>
      <TableCell className="truncate text-muted-foreground">
        {link.destinationUrl}
      </TableCell>
      <TableCell>
        <LinkStatusBadge status={link.status} />
      </TableCell>
      <TableCell className="text-right">{link.clickCount}</TableCell>
    </TableRow>
  );
}
