import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Link, ClickEventPage, UpdateLinkInput } from "@url-shortener/shared";
import { updateLinkSchema } from "@url-shortener/shared";
import { api } from "@/lib/api-client";
import { formatDateTime, toDatetimeLocal, fromDatetimeLocal } from "@/lib/date-format";
import { Field, FieldContent, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { LinkStatusBadge } from "@/components/link-status-badge";
import { ShortLinkCopy } from "@/components/short-link-copy";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ChevronLeftIcon from "~icons/lucide/chevron-left";
import ChevronRightIcon from "~icons/lucide/chevron-right";

/** Form-input shape (pre-z.coerce) vs. `UpdateLinkInput` (post-coerce output) - the resolver needs this to type the raw field values. */
type UpdateLinkFormValues = z.input<typeof updateLinkSchema>;

const CLICKS_PAGE_SIZE = 20;

export function LinkDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: link, isLoading, isError } = useQuery({
    queryKey: ["link", id],
    queryFn: () => api.links.get(id!),
    enabled: !!id,
  });

  const [clicksPage, setClicksPage] = useState(1);
  const { data: clicksData, isLoading: clicksLoading } = useQuery({
    queryKey: ["link-clicks", id, clicksPage],
    queryFn: () => api.links.listClicks(id!, { page: clicksPage, pageSize: CLICKS_PAGE_SIZE }),
    enabled: !!id,
    placeholderData: (previous) => previous,
  });

  const updateMutation = useMutation({
    mutationFn: (patch: UpdateLinkInput) => api.links.update(id!, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(["link", id], updated);
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (isError || !link) return <p className="text-sm text-destructive">Couldn't load this link.</p>;

  const shortUrl = `${link.domainHostname}/${link.shortCode}`;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <NameField link={link} onSave={(patch) => updateMutation.mutate(patch)} />
          <p className="mt-1 truncate text-sm text-muted-foreground">{link.destinationUrl}</p>
          <div className="mt-2 font-mono text-xs text-muted-foreground">
            <ShortLinkCopy shortUrl={shortUrl} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <LinkStatusBadge status={link.status} />
          <ActiveToggle
            isActive={link.isActive}
            onSave={(isActive) => updateMutation.mutate({ isActive })}
          />
        </div>
      </div>

      <DateFields link={link} onSave={(patch) => updateMutation.mutate(patch)} />

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Click log</h2>
        <ClickLogTable
          data={clicksData}
          isLoading={clicksLoading}
          page={clicksPage}
          onPrev={() => setClicksPage((p) => Math.max(1, p - 1))}
          onNext={() => setClicksPage((p) => p + 1)}
        />
      </div>
    </div>
  );
}

/** Inline-editable name field: react-hook-form + zodResolver against the shared updateLinkSchema, saving on blur. */
function NameField({ link, onSave }: { link: Link; onSave: (patch: UpdateLinkInput) => void }) {
  const form = useForm<UpdateLinkFormValues>({
    resolver: zodResolver(updateLinkSchema),
    defaultValues: { name: link.name },
  });

  function onSubmit(data: UpdateLinkFormValues) {
    if (data.name !== link.name) onSave({ name: data.name });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} onBlur={form.handleSubmit(onSubmit)}>
      <Controller
        name="name"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldContent>
              <Input
                {...field}
                value={field.value ?? ""}
                aria-invalid={fieldState.invalid}
                className="h-auto border-none px-0 text-lg font-medium shadow-none focus-visible:ring-0"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </FieldContent>
          </Field>
        )}
      />
    </form>
  );
}

/** Single boolean, no form needed - flips straight through the shared update mutation. */
function ActiveToggle({ isActive, onSave }: { isActive: boolean; onSave: (isActive: boolean) => void }) {
  return (
    <FieldLabel className="flex-row-reverse items-center gap-2 border-0 p-0 hover:bg-transparent">
      <span className="text-sm text-muted-foreground">Active</span>
      <Switch checked={isActive} onCheckedChange={onSave} />
    </FieldLabel>
  );
}

/**
 * Two inline-editable dates. Deliberately NOT reusing `updateLinkSchema`
 * here: react-hook-form + zodResolver validate against the schema's OUTPUT
 * type, so `z.coerce.date()` turns the raw `datetime-local` string into a
 * real `Date` before `onSubmit` ever sees it - a second validation pass
 * (e.g. on a later blur) then re-runs the same coercion on an already-a-Date
 * value and fails with a confusing "expected date, received Date". A tiny
 * local string-only schema for the raw input, converted to Date by hand
 * before calling the shared `onSave`, sidesteps that entirely. The shared
 * `updateLinkSchema` is still the source of truth for what the API accepts -
 * this local schema only shapes what the two text inputs hold.
 */
const dateFieldsFormSchema = z.object({
  startAt: z.string().optional(),
  endAt: z.string().optional(),
});
type DateFieldsFormValues = z.infer<typeof dateFieldsFormSchema>;

function DateFields({ link, onSave }: { link: Link; onSave: (patch: UpdateLinkInput) => void }) {
  const form = useForm<DateFieldsFormValues>({
    resolver: zodResolver(dateFieldsFormSchema),
    defaultValues: {
      startAt: toDatetimeLocal(link.startAt),
      endAt: toDatetimeLocal(link.endAt),
    },
  });

  function onSubmit(data: DateFieldsFormValues) {
    const patch: UpdateLinkInput = {};
    const newStart = fromDatetimeLocal(data.startAt);
    const newEnd = fromDatetimeLocal(data.endAt);
    const currentStart = link.startAt ? new Date(link.startAt).getTime() : null;
    const currentEnd = link.endAt ? new Date(link.endAt).getTime() : null;
    if ((newStart?.getTime() ?? null) !== currentStart) patch.startAt = newStart;
    if ((newEnd?.getTime() ?? null) !== currentEnd) patch.endAt = newEnd;
    if (Object.keys(patch).length > 0) onSave(patch);
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      onBlur={form.handleSubmit(onSubmit)}
      className="grid max-w-md grid-cols-2 gap-4"
    >
      <Controller
        name="startAt"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>Starts</FieldLabel>
            <FieldContent>
              <Input
                {...field}
                value={field.value ?? ""}
                id={field.name}
                type="datetime-local"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </FieldContent>
          </Field>
        )}
      />
      <Controller
        name="endAt"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>Ends</FieldLabel>
            <FieldContent>
              <Input
                {...field}
                value={field.value ?? ""}
                id={field.name}
                type="datetime-local"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </FieldContent>
          </Field>
        )}
      />
    </form>
  );
}

function ClickLogTable({
  data,
  isLoading,
  page,
  onPrev,
  onNext,
}: {
  data: ClickEventPage | undefined;
  isLoading: boolean;
  page: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const hasNext = data ? data.items.length === CLICKS_PAGE_SIZE : false;

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Referrer</TableHead>
              <TableHead>User agent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && !data && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No clicks yet.
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((click) => (
              <TableRow key={click.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(click.occurredAt)}
                </TableCell>
                <TableCell className="font-mono text-xs">{click.ip ?? "—"}</TableCell>
                <TableCell className="max-w-64 truncate text-muted-foreground">
                  {click.referrer ?? "—"}
                </TableCell>
                <TableCell className="max-w-80 truncate text-xs text-muted-foreground">
                  {click.userAgent ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* No `total` in the click-log response, so this is prev/next-only, not a page count. */}
      <div className="mt-4 flex items-center justify-end gap-2 text-sm text-muted-foreground">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={onPrev}>
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span>Page {page}</span>
        <Button variant="outline" size="icon-sm" disabled={!hasNext} onClick={onNext}>
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </>
  );
}
