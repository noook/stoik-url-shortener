#!/bin/sh
# Issue an API token against a running Docker Compose stack, without needing
# Node/pnpm on the host - only `docker compose` itself. Run from the repo
# root (wherever docker-compose.yml lives), e.g.:
#
#   ./scripts/token.sh                  # defaults to a timestamped name
#   ./scripts/token.sh -n "recruiter-demo"
#
# Equivalent to (but shorter than):
#   docker compose exec api node dist/cli.js token:create -n "recruiter-demo"
set -e
cd "$(dirname "$0")/.."
docker compose exec api node dist/cli.js token:create "$@"
