import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(cookieParser());
  app.enableCors({
    // Credentialed CORS requires an exact origin, never "*" - the session
    // cookie only makes sense scoped to one known frontend origin.
    origin: configService.get<string>("WEB_ORIGIN") ?? "http://localhost:5173",
    credentials: true,
  });

  await app.listen(configService.get<number>("PORT") ?? 3000);
}
await bootstrap();
