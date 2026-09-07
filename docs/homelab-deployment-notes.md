# Homelab deployment notes

**This documents how the assessment author runs this project on their own
homelab. It is not part of the project's requirements or a prescribed
deployment method** — the generic `docker-compose.yml` at the repo root
and `docs/adding-a-domain.md` are the actual project-level references.
This file exists only so the author's own setup is explainable later,
kept separate from anything a reviewer would need to run the project
themselves.

## Setup

- A small LXC container running Docker, reachable over Tailscale.
- `docker compose` stacks live under `/opt/stacks/` on that host, one
  subdirectory per project - this one would go in `/opt/stacks/url-shortener/`.
- A single, shared, always-on Traefik instance runs its own stack on that
  host and picks up every project's services via Docker labels - it is
  **not** the same Traefik as the one bundled in this project's own
  `docker-compose.yml` (which is meant for running the stack in isolation:
  locally, in CI, for a reviewer). Deploying to the homelab means dropping
  the bundled `traefik` service from the compose file entirely and relying
  on the host's shared instance instead - see below.
- Cloudflare Tunnel wildcards a personal domain to the shared Traefik
  instance, so any new subdomain routes automatically once Traefik knows
  about it via labels; DNS itself needs no per-project change.

## What changes from the generic `docker-compose.yml`

Remove the bundled `traefik` service and `web`'s published port entirely,
and change the `api`/`web` services' labels and networking to match the
shared instance's actual config (see below for what that config is):
`PathPrefix` rules (routing on one shared entrypoint/port, what the
bundled Traefik uses) become `Host()` rules on the shared instance's `web`
entrypoint, and both services join the shared instance's external `proxy`
Docker network so it can discover them at all - roughly:

```yaml
services:
  api:
    networks:
      - default
      - proxy
    labels:
      - traefik.enable=true
      - traefik.http.routers.url-shortener-api.rule=Host(`go.example.com`) && PathPrefix(`/api`)
      - traefik.http.routers.url-shortener-api.entrypoints=web
      - traefik.http.services.url-shortener-api.loadbalancer.server.port=3000
  web:
    networks:
      - default
      - proxy
    labels:
      - traefik.enable=true
      - traefik.http.routers.url-shortener-web.rule=Host(`go.example.com`)
      - traefik.http.routers.url-shortener-web.entrypoints=web
      - traefik.http.services.url-shortener-web.loadbalancer.server.port=80
networks:
  proxy:
    external: true
```

The backtick quoting around the hostname in the `Host()` rule is literal
Traefik label syntax, not a typo - Traefik's own label parser expects it.
Worth double-checking with `docker inspect --format '{{json .Config.Labels}}' <container>`
after writing these, since a missed backtick fails silently (the router
just never matches) rather than erroring at startup.

The shared instance's own config only defines a single entrypoint named
`web` on `:80` (TLS is terminated upstream by the Cloudflare Tunnel, not
by Traefik itself), and pins `providers.docker.network: proxy` - it only
discovers containers actually joined to that external network, regardless
of what labels they carry. Two mistakes this setup will silently produce
if missed:
- Using `entrypoints=websecure` (the common convention elsewhere) instead
  of the actual `web` name here fails hard and loud at startup: `entryPoint
  "websecure" doesn't exist` / `no valid entryPoint for this router`.
- Forgetting to join `proxy` fails silently instead - the router is valid,
  but Traefik never sees the container, so the route just 404s/never
  matches, with nothing obviously wrong in the logs.

`postgres` stays off the shared Traefik network entirely - only `api` and
`web` need routes on it (`url-shortener-api`/`url-shortener-api-fallback`/
`url-shortener-web` in the actual labels), same split as the project's own
bundled setup. Every router/service name here is prefixed with the project
slug (`url-shortener-`) rather than the bare service name (`api`, `web`) -
the shared instance discovers labels from every project's containers on
the same `proxy` network, and Traefik namespaces routers/services by
whatever key the labels give it, not automatically by project/stack. A
bare `api` or `web` would silently collide with any other project on this
host using the same generic name, with no startup error - Traefik just
lets one shadow the other.

## Adding the actual domain

Once the container is reachable via the shared Traefik instance + the
tunnel, the app-level step is identical to any other deployment - see
`docs/adding-a-domain.md`. Nothing homelab-specific about registering the
hostname in the `domains` table.

## Using `docker-compose.homelab.yml` instead of hand-editing `docker-compose.yml`

Rather than editing the base compose file directly on `docker-host` (which
causes dirty, easy-to-lose local changes outside git), the diff described
above lives in a real override file,
[`docker-compose.homelab.yml`](../docker-compose.homelab.yml), applied on
top of the base file with `-f`:

```sh
cp .env.example .env   # set POSTGRES_PASSWORD (hex, not base64 - see Gotchas below) and HOMELAB_HOSTNAME
docker compose -f docker-compose.yml -f docker-compose.homelab.yml \
  up -d --build postgres api web
```

Requires the `proxy` external network to already exist - it's created
once by the shared Traefik stack itself (`networks: proxy: external:
true` there), not by this project, so `docker compose` will error out
clearly (`network proxy declared as external, but could not be found`) if
the shared stack isn't already running.

Deliberately `postgres api web` and not the bundled `traefik` service -
the shared instance handles routing, so nothing needs to be started for it
here. The override replaces the `api`/`web` services' Traefik labels
(`PathPrefix` on the bundled instance's port -> `Host()` on the shared
instance's actual `web` entrypoint, no `tls` label since Traefik itself
never terminates TLS here - see above), joins both services to the shared
instance's `proxy` network, and overrides `api`'s `WEB_ORIGIN`; `postgres`
is untouched, same split as above. It reads `HOMELAB_HOSTNAME` from `.env`
rather than hardcoding a domain, so it stays generic and reusable
regardless of whose homelab it's pointed at - see `.env.example` for the
variable.

Verified against a real (throwaway) Compose stack, including a real
Traefik container configured to match the shared instance's actual setup
(`web` entrypoint on `:80`, `providers.docker.network=proxy`, Docker label
discovery): `docker compose config` resolves the merged labels correctly
(real `Host()` backticks, `entrypoints=web`, `WEB_ORIGIN` overridden), the
stack comes up with `traefik` correctly absent and both services joined to
`proxy`, the API container is fully functional under it
(`token:create`/`domain:add` both work), and both routers actually
resolve through a real Traefik instance (`web` and `api` both reachable
via `Host: <hostname>` with no "no valid entryPoint" error - that error
was hit once against an earlier draft that guessed `websecure` as the
entrypoint name, since fixed to the shared instance's actual `web`).

## Gotchas hit running Postgres in this environment

- Postgres 18's official image expects its data directory mounted at
  `/var/lib/postgresql`, not the `/var/lib/postgresql/data` subpath used
  by earlier major versions - mounting the old path makes the container
  refuse to start. Already fixed in the project's own `docker-compose.yml`,
  noted here in case an older compose file gets copied in by habit.
- Keep Postgres credentials URL-safe if they ever need to go directly into
  a connection string by hand (e.g. for a one-off `psql` session) -
  hex-encoded secrets avoid characters that need percent-escaping in a URL;
  base64 output often doesn't.
