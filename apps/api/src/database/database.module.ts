import { Global, Inject, Injectable, Module, type OnModuleDestroy } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export const DATABASE_CONNECTION = Symbol("DATABASE_CONNECTION");
export type Database = PostgresJsDatabase<typeof schema>;

@Injectable()
class DatabaseConnectionHolder implements OnModuleDestroy {
  private readonly client: postgres.Sql;
  readonly db: Database;

  constructor(configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>("DATABASE_URL");
    this.client = postgres(connectionString);
    this.db = drizzle(this.client, { schema });
  }

  async onModuleDestroy() {
    await this.client.end();
  }
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    DatabaseConnectionHolder,
    {
      provide: DATABASE_CONNECTION,
      useFactory: (holder: DatabaseConnectionHolder) => holder.db,
      inject: [DatabaseConnectionHolder],
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}

export function InjectDatabase() {
  return Inject(DATABASE_CONNECTION);
}
