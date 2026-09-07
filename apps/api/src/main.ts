import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(cookieParser());
  // Express doesn't read X-Forwarded-For into req.ip unless told to trust
  // the proxy hop that set it - true for any reverse proxy, not specific
  // to Traefik or Cloudflare. Trusting exactly one hop assumes exactly one
  // reverse proxy sits directly in front of this container (Traefik,
  // whichever instance - see docker-compose.yml/docker-compose.homelab.yml);
  // that proxy is itself responsible for only forwarding a trustworthy
  // X-Forwarded-For (i.e. not blindly relaying whatever a client sent) -
  // see the shared homelab Traefik instance's forwardedHeaders.trustedIPs
  // config, not this repo, for that part.
  app.getHttpAdapter().getInstance().set("trust proxy", 1);
  app.enableCors({
    // Credentialed CORS requires an exact origin, never "*" - the session
    // cookie only makes sense scoped to one known frontend origin.
    origin: configService.get<string>("WEB_ORIGIN") ?? "http://localhost:5173",
    credentials: true,
  });

  await app.listen(configService.get<number>("PORT") ?? 3000);
}
await bootstrap();
