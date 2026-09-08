import { Module } from "@nestjs/common";
import { AdsController } from "./ads.controller.js";
import { AdsService } from "./ads.service.js";
import { AuthModule } from "../auth/auth.module.js";

@Module({
  imports: [AuthModule],
  controllers: [AdsController],
  providers: [AdsService],
})
export class AdsModule {}
