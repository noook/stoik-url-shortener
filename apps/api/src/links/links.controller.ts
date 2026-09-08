import { Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  checkAliasQuerySchema,
  createLinkSchema,
  paginationQuerySchema,
  updateLinkSchema,
  type CheckAliasQuery,
  type CreateLinkInput,
  type Link,
  type LinkPage,
  type PaginationQuery,
  type UpdateLinkInput,
} from "@url-shortener/shared";
import { LinksService } from "./links.service.js";
import { ClickEventsService } from "./click-events.service.js";
import { ApiTokenAuthGuard } from "../auth/api-token-auth.guard.js";
import { ZodBody, ZodQuery } from "../common/zod-validation.pipe.js";

@Controller("api/links")
@UseGuards(ApiTokenAuthGuard)
export class LinksController {
  constructor(
    private readonly linksService: LinksService,
    private readonly clickEventsService: ClickEventsService,
  ) {}

  @Post()
  async create(@ZodBody(createLinkSchema) body: CreateLinkInput): Promise<Link> {
    return this.linksService.create(body);
  }

  @Get()
  async list(@ZodQuery(paginationQuerySchema) query: PaginationQuery): Promise<LinkPage> {
    return this.linksService.list(query.page, query.pageSize);
  }

  @Get("check-alias")
  async checkAlias(@ZodQuery(checkAliasQuerySchema) query: CheckAliasQuery) {
    const available = await this.linksService.isAliasAvailable(query.domainId, query.alias);
    return { available };
  }

  @Get(":id")
  async findOne(@Param("id") id: string): Promise<Link> {
    const link = await this.linksService.findById(id);
    if (!link) throw new NotFoundException("Link not found");
    return link;
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @ZodBody(updateLinkSchema) body: UpdateLinkInput,
  ): Promise<Link | null> {
    return this.linksService.update(id, body);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.linksService.deactivate(id);
    return { ok: true };
  }

  @Get(":id/clicks")
  async clicks(
    @Param("id") id: string,
    @ZodQuery(paginationQuerySchema) query: PaginationQuery,
  ) {
    return this.clickEventsService.listForLink(id, query.page, query.pageSize);
  }
}
