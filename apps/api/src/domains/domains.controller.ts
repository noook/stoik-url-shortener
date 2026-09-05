import { Controller, Get, UseGuards } from "@nestjs/common";
import type { Domain } from "@url-shortener/shared";
import { DomainsService } from "./domains.service.js";
import { ApiTokenAuthGuard } from "../auth/api-token-auth.guard.js";

@Controller("api/domains")
@UseGuards(ApiTokenAuthGuard)
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get()
  async list(): Promise<Domain[]> {
    const rows = await this.domainsService.list();
    return rows.map((row) => ({ id: row.id, hostname: row.hostname, isDefault: row.isDefault }));
  }
}
