import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { InjectDatabase, type Database } from "../database/database.module.js";
import { domains } from "../database/schema.js";

@Injectable()
export class DomainsService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async list() {
    return this.db.select().from(domains).orderBy(domains.hostname);
  }

  async findByHostname(hostname: string) {
    const [row] = await this.db.select().from(domains).where(eq(domains.hostname, hostname)).limit(1);
    return row ?? null;
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(domains).where(eq(domains.id, id)).limit(1);
    return row ?? null;
  }

  /** Used by the domain:add CLI command - see docs/adding-a-domain.md for the full procedure. */
  async add(hostname: string, isDefault = false) {
    const [row] = await this.db
      .insert(domains)
      .values({ hostname, isDefault })
      .onConflictDoNothing({ target: domains.hostname })
      .returning();
    return row ?? (await this.findByHostname(hostname));
  }
}
