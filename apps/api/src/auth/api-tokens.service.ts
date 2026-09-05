import { Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { InjectDatabase, type Database } from "../database/database.module.js";
import { apiTokens } from "../database/schema.js";
import { generateApiToken, hashApiToken } from "./token.util.js";

@Injectable()
export class ApiTokensService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  /** Used by the token:create CLI command. Returns the plaintext token exactly once. */
  async createToken(name: string) {
    const plaintext = generateApiToken();
    const tokenHash = hashApiToken(plaintext);
    const [row] = await this.db
      .insert(apiTokens)
      .values({ name, tokenHash })
      .returning({ id: apiTokens.id, name: apiTokens.name });
    return { ...row, plaintext };
  }

  async findActiveByPlaintext(plaintext: string) {
    const tokenHash = hashApiToken(plaintext);
    const [row] = await this.db
      .select()
      .from(apiTokens)
      .where(and(eq(apiTokens.tokenHash, tokenHash), isNull(apiTokens.revokedAt)))
      .limit(1);
    return row ?? null;
  }

  async findActiveById(id: string) {
    const [row] = await this.db
      .select()
      .from(apiTokens)
      .where(and(eq(apiTokens.id, id), isNull(apiTokens.revokedAt)))
      .limit(1);
    return row ?? null;
  }

  async touchLastUsed(id: string) {
    await this.db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, id));
  }
}
