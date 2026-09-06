#!/bin/sh
# Runs pending Drizzle migrations against DATABASE_URL, then hands off to the
# real start command (`node dist/main.js` by default - see the Dockerfile's
# CMD). Keeping this in the entrypoint (not a separate compose service) means
# the schema is always current before the API accepts traffic, with no extra
# container to keep in sync.
set -e

echo "[entrypoint] running database migrations..."
npx drizzle-kit migrate --config drizzle.config.ts

echo "[entrypoint] starting API..."
exec "$@"
