import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller.js";
import { DatabaseModule } from "./database/database.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { DomainsModule } from "./domains/domains.module.js";
import { LinksModule } from "./links/links.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    DomainsModule,
    LinksModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
