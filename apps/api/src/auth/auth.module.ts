import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { ApiTokensService } from "./api-tokens.service.js";
import { ApiTokenAuthGuard } from "./api-token-auth.guard.js";

@Module({
  controllers: [AuthController],
  providers: [ApiTokensService, ApiTokenAuthGuard],
  exports: [ApiTokensService, ApiTokenAuthGuard],
})
export class AuthModule {}
