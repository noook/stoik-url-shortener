# ADR 0001: Short-code and domain uniqueness

## Status

Accepted.

## Context

A short link is identified by a short code (e.g. `AbC123`) that a browser
resolves through the redirect endpoint. The project requires support for
more than one domain serving short links (see `docs/adding-a-domain.md`),
and the create-link form lets a user request a custom alias rather than an
auto-generated code. This raises the actual question this ADR answers:
**what happens when two links are created with the same short code?**

Two readings were possible:

1. Short codes are unique globally, across every domain the instance
   serves - a code, once used, is spent everywhere.
2. Short codes are unique **per domain** - the same code can exist on two
   different domains and resolve to two different destinations, since
   which link a visitor reaches is really determined by *both* the
   hostname they typed and the code, not the code alone.

## Decision

**A short link's real identity is `(domain, short_code)`, not `short_code`
alone.** Uniqueness is enforced per domain:

- `links` has a composite unique index on `(domain_id, short_code)`
  (`links_domain_id_short_code_unique` in `apps/api/src/database/schema.ts`),
  not a unique constraint on `short_code` by itself.
- The redirect handler (`GET /:code`, `apps/api/src/links/redirect.controller.ts`)
  resolves by matching the request's `Host` header against `domains.hostname`
  *and* the path segment against `links.short_code` together
  (`LinksService.resolveForRedirect`) - never by code alone.
- Creating a link with a custom alias that's already taken **on that same
  domain** is a conflict (`409`, `LinksService.create`); the identical
  alias is perfectly valid to reuse on a different domain.
- Auto-generated codes (`nanoid`, see `LinksService.create`) retry on
  collision rather than pre-checking availability, since a random-code
  collision within one domain is expected to be astronomically rare -
  not worth an extra query on every single-attempt creation.

The database is the actual arbiter of conflicts, not an application-level
pre-check: `insertOne` uses `onConflictDoNothing({ target: [links.domainId,
links.shortCode] })` and treats a `null` return as the signal to either
retry (auto-generated codes) or surface a `409` (a requested alias).

## Consequences

- Two visitors typing `go1.example.com/promo` and `go2.example.com/promo`
  can land on two entirely different destinations - this is intended
  behavior, not a bug, and follows directly from short links being scoped
  per domain.
- Adding a domain (`docs/adding-a-domain.md`) never needs to worry about
  colliding with short codes already used on a different domain - the two
  code spaces are fully independent.
- The `/api/links/check-alias` endpoint (used by the create-link form to
  validate a chosen alias before submit) takes both `domainId` and `alias`
  as required parameters, not alias alone, consistent with the same
  per-domain scoping.

## Related decisions folded in here

Two smaller decisions from the same design pass, kept in this ADR since
they were reasoned through alongside the uniqueness question:

**Redirects are always `302 Found`, never `301 Moved Permanently`.** A
`301` is heuristically cached by browsers even without an explicit
`Cache-Control` header, so a visitor whose browser has cached one would
stop contacting the server entirely on repeat visits - breaking both click
logging and the ability for an edited or expired link to actually take
effect for that visitor. `302` (and `307`, which additionally preserves
the HTTP method) are not cached by default, so every click reaches the
server. See `RedirectController`'s doc comment for the same reasoning
inline with the code.

**Auth is a long-lived API token, not a session on top of one.** The token
issued by the `token:create` CLI command is the actual credential - there's
no separate session concept layered on top of it. The httpOnly cookie set
by `POST /api/auth/session` holds that same token value; its only job is
keeping the token out of reach of page-side JavaScript, which an httpOnly
cookie already accomplishes on its own. A `Bearer` header with the same
token works identically for non-browser clients (`ApiTokenAuthGuard`
checks both). `SameSite=Lax` on the cookie is the actual cross-site
mitigation in place; no separate CSRF-token mechanism was built on top of
it for this project's scope.
