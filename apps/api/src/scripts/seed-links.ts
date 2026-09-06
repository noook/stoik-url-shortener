import "dotenv/config";
import consola from "consola";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { customAlphabet } from "nanoid";
import { domains, links, clickEvents } from "../database/schema.js";

/**
 * Seeds a realistic batch of demo links (default 200) across whichever
 * domains are already in the DB (run `pnpm seed` first if the table is
 * empty). Distributes across active/scheduled/expired/inactive statuses and
 * adds a handful of click events per link so the list/detail screens have
 * real click counts and timestamps to render, not just empty states.
 *
 * Usage: pnpm --filter api seed:links [count]
 */
const shortCode = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");

const SAMPLE_DESTINATIONS = [
  "https://github.com/anthropics/claude-code",
  "https://nestjs.com/",
  "https://react.dev/learn",
  "https://vite.dev/guide/",
  "https://orm.drizzle.team/docs/overview",
  "https://www.postgresql.org/docs/current/",
  "https://ui.shadcn.com/docs",
  "https://tailwindcss.com/docs/installation",
  "https://npmjs.com/package/zod",
  "https://tanstack.com/query/latest",
  "https://reactrouter.com/en/main",
  "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302",
  "https://news.ycombinator.com/",
  "https://stackoverflow.com/questions/tagged/typescript",
  "https://docs.docker.com/compose/",
  "https://pnpm.io/workspaces",
  "https://www.rfc-editor.org/rfc/rfc7231",
  "https://en.wikipedia.org/wiki/URL_shortening",
  "https://ui.shadcn.com/docs/forms/react-hook-form",
  "https://unjs.io/",
];

const NAME_PREFIXES = [
  "Launch announcement",
  "Onboarding doc",
  "Team wiki",
  "Product demo",
  "Sprint retro notes",
  "Release notes",
  "API reference",
  "Support ticket",
  "Marketing landing",
  "Internal tool",
  "Customer survey",
  "Design spec",
  "Postmortem",
  "Roadmap",
  "Changelog",
];

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "curl/8.7.1",
];

const REFERRERS = [
  null,
  "https://twitter.com/",
  "https://news.ycombinator.com/",
  "https://www.google.com/",
  "https://slack.com/",
  null,
];

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function randomIp(): string {
  return `${randRange(1, 255)}.${randRange(0, 255)}.${randRange(0, 255)}.${randRange(0, 255)}`;
}

function randRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

type StatusPlan =
  | { kind: "active" }
  | { kind: "scheduled"; startAt: Date }
  | { kind: "expired"; startAt: Date | null; endAt: Date }
  | { kind: "inactive" };

function pickStatusPlan(): StatusPlan {
  const roll = Math.random();
  if (roll < 0.65) return { kind: "active" };
  if (roll < 0.78) return { kind: "scheduled", startAt: daysFromNow(randRange(1, 30)) };
  if (roll < 0.9) {
    return {
      kind: "expired",
      startAt: Math.random() < 0.5 ? daysAgo(randRange(60, 120)) : null,
      endAt: daysAgo(randRange(1, 30)),
    };
  }
  return { kind: "inactive" };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    consola.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const count = Number.parseInt(process.argv[2] ?? "200", 10) || 200;

  const client = postgres(connectionString);
  const db = drizzle(client, { schema: { domains, links, clickEvents } });

  const domainRows = await db.select().from(domains);
  if (domainRows.length === 0) {
    consola.error("No domains found - run `pnpm seed` first to seed the link domains.");
    await client.end();
    process.exit(1);
  }

  consola.info(`Seeding ${count} links across ${domainRows.length} domain(s)...`);

  let created = 0;
  let totalClicks = 0;

  for (let i = 0; i < count; i++) {
    const domain = randomItem(domainRows);
    const plan = pickStatusPlan();
    const createdAt = daysAgo(randRange(0, 90));

    const values: typeof links.$inferInsert = {
      domainId: domain.id,
      shortCode: shortCode(7),
      label: `${randomItem(NAME_PREFIXES)} ${i + 1}`,
      destinationUrl: randomItem(SAMPLE_DESTINATIONS),
      isActive: plan.kind !== "inactive",
      createdAt,
      startAt: plan.kind === "scheduled" ? plan.startAt : plan.kind === "expired" ? plan.startAt : null,
      endAt: plan.kind === "expired" ? plan.endAt : null,
    };

    const [row] = await db.insert(links).values(values).returning({ id: links.id });
    if (!row) continue;
    created++;

    // Active and expired links get a realistic click history; scheduled and
    // inactive links stay at zero clicks (nobody could have hit them yet /
    // they were turned off) - matches what the redirect handler would
    // actually produce over time.
    if (plan.kind === "active" || plan.kind === "expired") {
      const clickTarget = randRange(0, 60);
      if (clickTarget > 0) {
        const events: (typeof clickEvents.$inferInsert)[] = Array.from({ length: clickTarget }, () => ({
          linkId: row.id,
          ip: randomIp(),
          userAgent: randomItem(USER_AGENTS),
          referrer: randomItem(REFERRERS),
          occurredAt: new Date(createdAt.getTime() + Math.random() * (Date.now() - createdAt.getTime())),
        }));
        await db.insert(clickEvents).values(events);
        totalClicks += events.length;
      }
    }

    if ((i + 1) % 50 === 0) {
      consola.info(`  ...${i + 1}/${count}`);
    }
  }

  consola.success(`Seeded ${created} links and ${totalClicks} click events.`);
  await client.end();
}

await main();
