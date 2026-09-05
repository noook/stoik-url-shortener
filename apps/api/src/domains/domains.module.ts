import { Module } from "@nestjs/common";
import { DomainsController } from "./domains.controller.js";
import { DomainsService } from "./domains.service.js";
import { AuthModule } from "../auth/auth.module.js";

@Module({
  imports: [AuthModule],
  controllers: [DomainsController],
  providers: [DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}
