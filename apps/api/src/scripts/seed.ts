import "dotenv/config";
import consola from "consola";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { domains } from "../database/schema.js";

/**
 * Seeds the two "link domains" the plan requires for the live domain-conflict demo
 * (see docs/adr/0001-domain-and-shortcode-uniqueness.md). Hostnames come from env
 * so this script works the same locally and in the homelab deployment - see
 * docs/adding-a-domain.md for how to add a third one later via the domain:add CLI.
 *
 * Usage: pnpm --filter api seed
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    consola.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const seedHostnames = (process.env.SEED_DOMAINS ?? "go1.localhost,go2.localhost")
    .split(",")
    .map((hostname) => hostname.trim())
    .filter(Boolean);

  const client = postgres(connectionString);
  const db = drizzle(client);

  for (const [index, hostname] of seedHostnames.entries()) {
    await db
      .insert(domains)
      .values({ hostname, isDefault: index === 0 })
      .onConflictDoNothing({ target: domains.hostname });
    consola.success(`Seeded domain: ${hostname}${index === 0 ? " (default)" : ""}`);
  }

  await client.end();
}

await main();
