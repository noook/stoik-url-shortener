import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { ApiTokensService } from "./api-tokens.service.js";
import { SessionCodec } from "./session-codec.js";
import { SESSION_COOKIE_NAME } from "./session.constants.js";

export interface AuthenticatedRequest extends Request {
  apiToken: { id: string; name: string };
}

/**
 * Guards every protected route via the session cookie (see plan §2.1) - never
 * by reading a bearer token from the frontend directly, since the SPA never
 * holds one. The one exception is POST /api/auth/session itself, which reads
 * the CLI-issued bearer token to *create* the session in the first place.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly sessionCodec: SessionCodec,
    private readonly apiTokensService: ApiTokensService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookieValue = (request.cookies as Record<string, string> | undefined)?.[
      SESSION_COOKIE_NAME
    ];
    const payload = this.sessionCodec.decode(cookieValue);
    if (!payload) {
      throw new UnauthorizedException("No valid session");
    }

    const token = await this.apiTokensService.findActiveById(payload.tokenId);
    if (!token) {
      throw new UnauthorizedException("Session's token has been revoked");
    }

    request.apiToken = { id: token.id, name: token.name };
    return true;
  }
}
