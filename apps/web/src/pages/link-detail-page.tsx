import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { Link, ClickEventPage, UpdateLinkInput } from "@url-shortener/shared";
import { updateLinkSchema } from "@url-shortener/shared";
import { api } from "@/lib/api-client";
import { Field, FieldContent, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** Form-input shape (pre-z.coerce) vs. `UpdateLinkInput` (post-coerce output) - the resolver needs this to type the raw field values. */
type UpdateLinkFormValues = z.input<typeof updateLinkSchema>;

/**
 * PAIRING NOTE (link detail screen):
 *
 * Data layer is wired below - `link`, `clicksData`, and `updateMutation` are
 * ready to use. `NameField` is a fully worked example of the inline-edit
 * pattern (react-hook-form + zodResolver against the shared `updateLinkSchema`,
 * same shared-schema trick as the login form, calling `updateMutation.mutate`
 * on submit).
 *
 * Your turn to build, following that same pattern:
 *
 * 1. `ActiveToggle` - swap the placeholder below for a real `Switch` (already
 *    installed: @/components/ui/switch) bound to `link.isActive`. No form
 *    needed for a single boolean - just call
 *    `updateMutation.mutate({ isActive: checked })` straight from
 *    `onCheckedChange`.
 * 2. `DateFields` - two inline-editable dates (startAt/endAt), same
 *    react-hook-form + updateLinkSchema pattern as NameField. Use
 *    `<Input type="datetime-local">` - datetime-local wants
 *    `"yyyy-MM-ddTHH:mm"` in local time, and needs converting back to a Date
 *    on submit. `updateLinkSchema` accepts `null` for both fields (clearing a
 *    date), not just `undefined` - decide how the UI exposes "clear".
 * 3. `ClickLogTable` - paginated table of `clicksData.items` (ip, userAgent,
 *    referrer, occurredAt). `links-list-page.tsx` is a directly-reusable
 *    model for the table markup + prev/next pagination controls; `clicksData`
 *    here already has the same page/pageSize/total-less shape (check the API
 *    response - does `/links/:id/clicks` return a `total`? if not, you'll
 *    want prev/next-only pagination, not a page count).
 *
 * Status badge + short link + destination link: `links-list-page.tsx` already
 * has this exact rendering (STATUS_BADGE map, shortUrl + copy-to-clipboard
 * button) - reuse or extract rather than reinventing it here.
 */

export function LinkDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: link, isLoading, isError } = useQuery({
    queryKey: ["link", id],
    queryFn: () => api<Link>(`/links/${id}`),
    enabled: !!id,
  });

  const [clicksPage, setClicksPage] = useState(1);
  const { data: clicksData } = useQuery({
    queryKey: ["link-clicks", id, clicksPage],
    queryFn: () =>
      api<ClickEventPage>(`/links/${id}/clicks`, {
        query: { page: clicksPage, pageSize: 20 },
      }),
    enabled: !!id,
    placeholderData: (previous) => previous,
  });

  const updateMutation = useMutation({
    mutationFn: (patch: UpdateLinkInput) => api<Link>(`/links/${id}`, { method: "PATCH", body: patch }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["link", id], updated);
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (isError || !link) return <p className="text-sm text-destructive">Couldn't load this link.</p>;

  return (
    <div className="space-y-8">
      <div>
        <NameField link={link} onSave={(patch) => updateMutation.mutate(patch)} />
        <p className="mt-1 text-sm text-muted-foreground">{link.destinationUrl}</p>
      </div>

      {/* TODO: ActiveToggle, DateFields - see pairing note above */}

      {/* TODO: ClickLogTable using clicksData, setClicksPage - see pairing note above */}
    </div>
  );
}

/** Worked example: inline-editable name field, same shared-schema pattern as the login form. */
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
