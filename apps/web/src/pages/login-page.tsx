import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createSessionSchema, type CreateSessionInput } from "@url-shortener/shared";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string | null>(null);

  const form = useForm<CreateSessionInput>({
    resolver: zodResolver(createSessionSchema),
    defaultValues: { token: "" },
  });

  async function onSubmit(data: CreateSessionInput) {
    setLoginError(null);
    try {
      await login(data.token);
      navigate("/", { replace: true });
    } catch {
      setLoginError("That token isn't valid or has been revoked.");
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-lg font-medium">Log in</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Paste the API token issued by <code>token:create</code>.
      </p>

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <Controller
            name="token"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>API token</FieldLabel>
                <FieldContent>
                  <Input
                    {...field}
                    id={field.name}
                    type="password"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                    placeholder="Paste your token"
                  />
                  <FieldDescription>
                    Never stored in the browser in a readable way - only sent once to
                    exchange for an httpOnly session cookie.
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </FieldContent>
              </Field>
            )}
          />

          {loginError && (
            <p role="alert" className="text-sm text-destructive">
              {loginError}
            </p>
          )}

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Logging in…" : "Log in"}
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}
