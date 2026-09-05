import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "../database/database.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { DomainsModule } from "../domains/domains.module.js";
import { TokenCreateCommand } from "./token-create.command.js";
import { DomainAddCommand } from "./domain-add.command.js";

/**
 * Lightweight module for CLI entrypoint (see src/cli.ts) - reuses the same
 * services/DB module as the HTTP app, deliberately excludes controllers.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, AuthModule, DomainsModule],
  providers: [TokenCreateCommand, DomainAddCommand],
})
export class CliModule {}
