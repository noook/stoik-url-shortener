// TODO(pairing): build the create-link screen here.
//
// What it needs: destinationUrl, optional name, domain picker (GET
// /api/domains), an optional short-code field (blank = auto-generate,
// filled in = custom alias - see packages/shared's createLinkSchema, it's
// a discriminated union on alias vs autoLength), optional start/end dates.
// POST /api/links, navigate to /links/:id on success.
//
// react-hook-form + @hookform/resolvers/zod + createLinkSchema from
// @url-shortener/shared gets you client-side validation matching the API's
// ZodValidationPipe exactly - same schema, both ends.
export function CreateLinkPage() {
  return (
    <div>
      <h1 className="text-lg font-medium mb-4">Create link</h1>
      <p className="text-sm text-muted-foreground">TODO: build the create-link form here.</p>
    </div>
  );
}
