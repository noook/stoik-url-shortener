import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, desc, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import {
  computeLinkStatus,
  DEFAULT_SHORT_CODE_LENGTH,
  type CreateLinkInput,
  type UpdateLinkInput,
} from "@url-shortener/shared";
import { InjectDatabase, type Database } from "../database/database.module.js";
import { links, domains, clickEvents } from "../database/schema.js";
import { DomainsService } from "../domains/domains.service.js";

// url-safe alphabet, no ambiguous-looking chars removed on purpose - keeping
// it simple for an assessment; nanoid's default alphabet is already url-safe.
const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz");

const MAX_GENERATE_ATTEMPTS = 5;

@Injectable()
export class LinksService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly domainsService: DomainsService,
  ) {}

  /**
   * Creates a link. If the client supplied `alias`, that exact code is used
   * (and the DB's (domain_id, short_code) unique index is the real arbiter of
   * whether it's available - see docs/adr/0001-*.md). Otherwise a code is
   * generated and insertion retried on conflict, since a collision on a
   * randomly generated code is expected to be astronomically rare, not worth
   * pre-checking for.
   */
  async create(input: CreateLinkInput) {
    const domain = await this.domainsService.findById(input.domainId);
    if (!domain) {
      throw new NotFoundException("Domain not found");
    }

    const label = input.label?.trim() || input.destinationUrl;

    if ("alias" in input && input.alias) {
      const row = await this.insertOne({
        domainId: input.domainId,
        shortCode: input.alias,
        label,
        destinationUrl: input.destinationUrl,
        startAt: input.startAt,
        endAt: input.endAt,
      });
      if (!row) {
        throw new ConflictException(
          `Short code "${input.alias}" is already in use on ${domain.hostname}`,
        );
      }
      return this.toApiShape(row, domain.hostname);
    }

    const length =
      ("autoLength" in input && input.autoLength) || DEFAULT_SHORT_CODE_LENGTH;
    for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt++) {
      const shortCode = nanoid(length);
      const row = await this.insertOne({
        domainId: input.domainId,
        shortCode,
        label,
        destinationUrl: input.destinationUrl,
        startAt: input.startAt,
        endAt: input.endAt,
      });
      if (row) return this.toApiShape(row, domain.hostname);
    }
    throw new ConflictException(
      "Could not generate a unique short code after several attempts - try again",
    );
  }

  private async insertOne(values: {
    domainId: string;
    shortCode: string;
    label: string;
    destinationUrl: string;
    startAt?: Date;
    endAt?: Date;
  }) {
    const [row] = await this.db
      .insert(links)
      .values(values)
      .onConflictDoNothing({ target: [links.domainId, links.shortCode] })
      .returning();
    return row ?? null;
  }

  async list(page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const rows = await this.db
      .select({
        link: links,
        domainHostname: domains.hostname,
        clickCount: count(clickEvents.id),
      })
      .from(links)
      .innerJoin(domains, eq(links.domainId, domains.id))
      .leftJoin(clickEvents, eq(clickEvents.linkId, links.id))
      .groupBy(links.id, domains.hostname)
      .orderBy(desc(links.createdAt))
      .limit(pageSize)
      .offset(offset);

    const [{ total }] = await this.db.select({ total: count() }).from(links);

    return {
      items: rows.map((row) =>
        this.toApiShape(row.link, row.domainHostname, {
          clickCount: row.clickCount,
          lastClickAt: null,
        }),
      ),
      total,
      page,
      pageSize,
    };
  }

  async findById(id: string) {
    const [row] = await this.db
      .select({ link: links, domainHostname: domains.hostname })
      .from(links)
      .innerJoin(domains, eq(links.domainId, domains.id))
      .where(eq(links.id, id))
      .limit(1);
    if (!row) return null;

    const [{ clickCount }] = await this.db
      .select({ clickCount: count() })
      .from(clickEvents)
      .where(eq(clickEvents.linkId, id));
    const [lastClick] = await this.db
      .select({ occurredAt: clickEvents.occurredAt })
      .from(clickEvents)
      .where(eq(clickEvents.linkId, id))
      .orderBy(desc(clickEvents.occurredAt))
      .limit(1);

    return this.toApiShape(row.link, row.domainHostname, {
      clickCount,
      lastClickAt: lastClick?.occurredAt ?? null,
    });
  }

  async update(id: string, input: UpdateLinkInput) {
    const set = {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.startAt !== undefined ? { startAt: input.startAt } : {}),
      ...(input.endAt !== undefined ? { endAt: input.endAt } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    };

    // Drizzle/Postgres has no valid SQL for `update ... set <nothing>` - an
    // empty `set` renders as `update links set  where ...`, a syntax error.
    // updateLinkSchema allows an all-optional, empty {} body, so this isn't
    // hypothetical: skip the write and just confirm the row exists.
    if (Object.keys(set).length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new NotFoundException("Link not found");
      return existing;
    }

    const [row] = await this.db.update(links).set(set).where(eq(links.id, id)).returning();
    if (!row) throw new NotFoundException("Link not found");
    return this.findById(id);
  }

  async deactivate(id: string) {
    const [row] = await this.db
      .update(links)
      .set({ isActive: false })
      .where(eq(links.id, id))
      .returning();
    if (!row) throw new NotFoundException("Link not found");
  }

  async isAliasAvailable(domainId: string, alias: string) {
    const [row] = await this.db
      .select({ id: links.id })
      .from(links)
      .where(and(eq(links.domainId, domainId), eq(links.shortCode, alias)))
      .limit(1);
    return !row;
  }

  /**
   * Used by the public redirect handler. Resolution is (domain, code), never
   * code alone - see docs/adr/0001-domain-and-shortcode-uniqueness.md.
   */
  async resolveForRedirect(hostname: string, shortCode: string) {
    const [row] = await this.db
      .select({ link: links })
      .from(links)
      .innerJoin(domains, eq(links.domainId, domains.id))
      .where(and(eq(domains.hostname, hostname), eq(links.shortCode, shortCode)))
      .limit(1);
    return row?.link ?? null;
  }

  private toApiShape(
    row: typeof links.$inferSelect,
    domainHostname: string,
    stats: { clickCount: number; lastClickAt: Date | null } = { clickCount: 0, lastClickAt: null },
  ) {
    return {
      id: row.id,
      domainId: row.domainId,
      domainHostname,
      shortCode: row.shortCode,
      label: row.label,
      destinationUrl: row.destinationUrl,
      startAt: row.startAt,
      endAt: row.endAt,
      isActive: row.isActive,
      status: computeLinkStatus({
        isActive: row.isActive,
        startAt: row.startAt,
        endAt: row.endAt,
      }),
      createdAt: row.createdAt,
      clickCount: stats.clickCount,
      lastClickAt: stats.lastClickAt,
    };
  }
}
