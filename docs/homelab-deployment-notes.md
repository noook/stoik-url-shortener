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
and change the `api`/`web` services' labels from `PathPrefix` rules
(routing on one shared entrypoint/port, what the bundled Traefik uses) to
`Host()` rules (routing on the shared instance's real hostname-based
entrypoints), roughly:

```yaml
services:
  api:
    labels:
      - traefik.enable=true
      - traefik.http.routers.url-shortener-api.rule=Host(`go.example.com`) && PathPrefix(`/api`)
      - traefik.http.routers.url-shortener-api.entrypoints=websecure
      - traefik.http.routers.url-shortener-api.tls=true
      - traefik.http.services.url-shortener-api.loadbalancer.server.port=3000
  web:
    labels:
      - traefik.enable=true
      - traefik.http.routers.url-shortener-web.rule=Host(`go.example.com`)
      - traefik.http.routers.url-shortener-web.entrypoints=websecure
      - traefik.http.routers.url-shortener-web.tls=true
      - traefik.http.services.url-shortener-web.loadbalancer.server.port=80
```

The backtick quoting around the hostname in the `Host()` rule is literal
Traefik label syntax, not a typo - Traefik's own label parser expects it.
Worth double-checking with `docker inspect --format '{{json .Config.Labels}}' <container>`
after writing these, since a missed backtick fails silently (the router
just never matches) rather than erroring at startup.

`postgres` stays off the shared Traefik network entirely - only `api` and
`web` need routes on it, same split as the project's own bundled setup.

## Adding the actual domain

Once the container is reachable via the shared Traefik instance + the
tunnel, the app-level step is identical to any other deployment - see
`docs/adding-a-domain.md`. Nothing homelab-specific about registering the
hostname in the `domains` table.

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
