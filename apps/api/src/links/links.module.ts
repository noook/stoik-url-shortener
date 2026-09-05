import { Module } from "@nestjs/common";
import { LinksController } from "./links.controller.js";
import { RedirectController } from "./redirect.controller.js";
import { LinksService } from "./links.service.js";
import { ClickEventsService } from "./click-events.service.js";
import { AuthModule } from "../auth/auth.module.js";
import { DomainsModule } from "../domains/domains.module.js";

@Module({
  imports: [AuthModule, DomainsModule],
  controllers: [LinksController, RedirectController],
  providers: [LinksService, ClickEventsService],
})
export class LinksModule {}
