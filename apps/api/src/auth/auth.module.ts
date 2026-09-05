import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { ApiTokensService } from "./api-tokens.service.js";
import { SessionCodec } from "./session-codec.js";
import { SessionAuthGuard } from "./session-auth.guard.js";

@Module({
  controllers: [AuthController],
  providers: [ApiTokensService, SessionCodec, SessionAuthGuard],
  exports: [ApiTokensService, SessionCodec, SessionAuthGuard],
})
export class AuthModule {}
