import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import {
  checkAliasQuerySchema,
  createLinkSchema,
  updateLinkSchema,
  type Link,
  type LinkPage,
} from "@url-shortener/shared";
import { LinksService } from "./links.service.js";
import { ClickEventsService } from "./click-events.service.js";
import { ApiTokenAuthGuard } from "../auth/api-token-auth.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";

@Controller("api/links")
@UseGuards(ApiTokenAuthGuard)
export class LinksController {
  constructor(
    private readonly linksService: LinksService,
    private readonly clickEventsService: ClickEventsService,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createLinkSchema))
  async create(@Body() body: unknown): Promise<Link> {
    return this.linksService.create(body as Parameters<LinksService["create"]>[0]);
  }

  @Get()
  async list(
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string,
  ): Promise<LinkPage> {
    const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(pageSizeRaw ?? "20", 10) || 20));
    return this.linksService.list(page, pageSize);
  }

  @Get("check-alias")
  @UsePipes(new ZodValidationPipe(checkAliasQuerySchema))
  async checkAlias(@Query() query: { domainId: string; alias: string }) {
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
    @Body(new ZodValidationPipe(updateLinkSchema)) body: unknown,
  ): Promise<Link | null> {
    return this.linksService.update(id, body as Parameters<LinksService["update"]>[1]);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.linksService.deactivate(id);
    return { ok: true };
  }

  @Get(":id/clicks")
  async clicks(
    @Param("id") id: string,
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string,
  ) {
    const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(pageSizeRaw ?? "20", 10) || 20));
    return this.clickEventsService.listForLink(id, page, pageSize);
  }
}
