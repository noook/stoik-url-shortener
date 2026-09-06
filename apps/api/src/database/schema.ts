import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const domains = pgTable("domains", {
  id: uuid("id").defaultRandom().primaryKey(),
  hostname: text("hostname").notNull().unique(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const links = pgTable(
  "links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "restrict" }),
    shortCode: text("short_code").notNull(),
    label: text("label").notNull(),
    destinationUrl: text("destination_url").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The answer to "what happens when two users pick the same short code": they
    // cannot collide within the same domain (DB rejects it, API returns 409), but
    // the same code IS allowed to exist on two different domains, because a short
    // link's identity is (domain, code), not code alone. See docs/adr/0001-*.
    uniqueIndex("links_domain_id_short_code_unique").on(table.domainId, table.shortCode),
    index("links_domain_id_idx").on(table.domainId),
  ],
);

export const clickEvents = pgTable(
  "click_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    linkId: uuid("link_id")
      .notNull()
      .references(() => links.id, { onDelete: "cascade" }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    referrer: text("referrer"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("click_events_link_id_idx").on(table.linkId)],
);
