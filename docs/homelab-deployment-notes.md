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
- Traefik runs as its own always-on stack and picks up new services via
  Docker labels - no manual reverse-proxy config file per project.
- Cloudflare Tunnel wildcards a personal domain to Traefik, so any new
  subdomain routes automatically once Traefik knows about it via labels;
  DNS itself needs no per-project change.

## What changes from the generic `docker-compose.yml`

The `web` service gets Traefik labels instead of (or alongside) its
published port, roughly:

```yaml
services:
  web:
    labels:
      - traefik.enable=true
      - traefik.http.routers.url-shortener.rule=Host(`go.example.com`)
      - traefik.http.routers.url-shortener.entrypoints=websecure
      - traefik.http.routers.url-shortener.tls=true
      - traefik.http.services.url-shortener.loadbalancer.server.port=80
```

The backtick quoting around the hostname in the `Host()` rule is literal
Traefik label syntax, not a typo - Traefik's own label parser expects it.
Worth double-checking with `docker inspect --format '{{json .Config.Labels}}' <container>`
after writing these, since a missed backtick fails silently (the router
just never matches) rather than erroring at startup.

`postgres` and `api` stay on the compose network, not exposed to Traefik
directly - only `web`'s nginx (which already reverse-proxies `/api/*` to
the `api` service, see `apps/web/nginx.conf`) needs a public route.

## Adding the actual domain

Once the container is reachable via Traefik + the tunnel, the app-level
step is identical to any other deployment - see `docs/adding-a-domain.md`.
Nothing homelab-specific about registering the hostname in the `domains`
table.

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
