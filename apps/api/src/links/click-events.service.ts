import { Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { InjectDatabase, type Database } from "../database/database.module.js";
import { clickEvents } from "../database/schema.js";

@Injectable()
export class ClickEventsService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * Fire-and-forget from the redirect handler's point of view (caller doesn't
   * await this before responding) - logging a click should never slow down or
   * risk failing the actual redirect.
   */
  async record(linkId: string, params: { ip: string | null; userAgent: string | null; referrer: string | null }) {
    await this.db.insert(clickEvents).values({
      linkId,
      ip: params.ip,
      userAgent: params.userAgent,
      referrer: params.referrer,
    });
  }

  async listForLink(linkId: string, page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const items = await this.db
      .select()
      .from(clickEvents)
      .where(eq(clickEvents.linkId, linkId))
      .orderBy(desc(clickEvents.occurredAt))
      .limit(pageSize)
      .offset(offset);
    return { items, page, pageSize };
  }
}
