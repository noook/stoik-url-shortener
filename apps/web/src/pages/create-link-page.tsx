import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Domain, Link } from "@url-shortener/shared";
import { SHORT_CODE_PATTERN } from "@url-shortener/shared";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Local form schema, deliberately not the shared `createLinkSchema` -
 * same reasoning as `DateFields` on the link detail page: `createLinkSchema`
 * uses `z.coerce.date()` and an `alias`/`autoLength` discriminated union,
 * both awkward to drive from plain form inputs (a blank date input, a blank
 * alias input meaning "auto-generate"). This schema shapes what the form's
 * raw string inputs hold; `toCreateLinkInput` below turns a valid submission
 * into the actual `CreateLinkInput` shape the API expects, which is where
 * `createLinkSchema` remains the real source of truth (the API re-validates
 * with it regardless).
 */
const createLinkFormSchema = z
  .object({
    destinationUrl: z.url("Must be a valid URL"),
    name: z.string().optional(),
    domainId: z.string().min(1, "Pick a domain"),
    alias: z
      .string()
      .optional()
      .refine((value) => !value || SHORT_CODE_PATTERN.test(value), {
        message: "Short code must be 3-32 chars: letters, digits, _ or -",
      }),
    startAt: z.string().optional(),
    endAt: z.string().optional(),
  })
  .refine((data) => !data.startAt || !data.endAt || data.startAt < data.endAt, {
    message: "Start must be before end",
    path: ["endAt"],
  });
type CreateLinkFormValues = z.infer<typeof createLinkFormSchema>;

export function CreateLinkPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: domains, isLoading: domainsLoading } = useQuery({
    queryKey: ["domains"],
    queryFn: () => api<Domain[]>("/domains"),
  });

  const form = useForm<CreateLinkFormValues>({
    resolver: zodResolver(createLinkFormSchema),
    defaultValues: { destinationUrl: "", name: "", domainId: "", alias: "", startAt: "", endAt: "" },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateLinkFormValues) => api<Link>("/links", { method: "POST", body: toCreateLinkInput(values) }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["links"] });
      navigate(`/links/${created.id}`);
    },
  });

  // Default to the account's default domain once the list loads, if the user hasn't picked one yet.
  const defaultDomain = domains?.find((domain) => domain.isDefault) ?? domains?.[0];
  if (defaultDomain && !form.getValues("domainId") && !form.formState.dirtyFields.domainId) {
    form.setValue("domainId", defaultDomain.id);
  }

  function onSubmit(values: CreateLinkFormValues) {
    createMutation.mutate(values);
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-lg font-medium">Create link</h1>
      <Card>
        <CardHeader>
          <CardTitle>New short link</CardTitle>
          <CardDescription>Leave the short code blank to generate one automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <Controller
                name="destinationUrl"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Destination URL</FieldLabel>
                    <FieldContent>
                      <Input {...field} id={field.name} placeholder="https://example.com/page" aria-invalid={fieldState.invalid} />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </FieldContent>
                  </Field>
                )}
              />

              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                    <FieldContent>
                      <Input {...field} id={field.name} placeholder="Optional - defaults to the destination URL" aria-invalid={fieldState.invalid} />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </FieldContent>
                  </Field>
                )}
              />

              <Controller
                name="domainId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Domain</FieldLabel>
                    <FieldContent>
                      <Select value={field.value} onValueChange={field.onChange} disabled={domainsLoading}>
                        <SelectTrigger id={field.name} className="w-full" aria-invalid={fieldState.invalid}>
                          <SelectValue placeholder={domainsLoading ? "Loading…" : "Pick a domain"} />
                        </SelectTrigger>
                        <SelectContent>
                          {domains?.map((domain) => (
                            <SelectItem key={domain.id} value={domain.id}>
                              {domain.hostname}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </FieldContent>
                  </Field>
                )}
              />

              <Controller
                name="alias"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Custom short code</FieldLabel>
                    <FieldContent>
                      <Input {...field} id={field.name} placeholder="Optional - blank generates one automatically" aria-invalid={fieldState.invalid} />
                      <FieldDescription>3-32 characters: letters, digits, _ or -.</FieldDescription>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </FieldContent>
                  </Field>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <Controller
                  name="startAt"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>Starts</FieldLabel>
                      <FieldContent>
                        <Input {...field} id={field.name} type="datetime-local" aria-invalid={fieldState.invalid} />
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
                        <Input {...field} id={field.name} type="datetime-local" aria-invalid={fieldState.invalid} />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </FieldContent>
                    </Field>
                  )}
                />
              </div>

              {createMutation.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {extractErrorMessage(createMutation.error)}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => navigate("/")}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating…" : "Create link"}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function toCreateLinkInput(values: CreateLinkFormValues) {
  return {
    destinationUrl: values.destinationUrl,
    name: values.name?.trim() || undefined,
    domainId: values.domainId,
    startAt: values.startAt ? new Date(values.startAt) : undefined,
    endAt: values.endAt ? new Date(values.endAt) : undefined,
    ...(values.alias ? { alias: values.alias } : {}),
  };
}

/** ofetch throws a FetchError whose `.data` is the Nest error body (`{ message }`) - surface that verbatim rather than a generic failure string. */
function extractErrorMessage(error: unknown): string {
  const data = (error as { data?: { message?: string | string[] } } | undefined)?.data;
  if (!data?.message) return "Couldn't create the link. Please try again.";
  return Array.isArray(data.message) ? data.message.join(", ") : data.message;
}
