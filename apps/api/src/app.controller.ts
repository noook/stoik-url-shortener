import { Controller, Get, Inject } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DATABASE_CONNECTION, type Database } from "./database/database.module.js";

@Controller()
export class AppController {
  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  @Get("health")
  async health() {
    await this.db.execute(sql`select 1`);
    return { status: "ok" };
  }
}
