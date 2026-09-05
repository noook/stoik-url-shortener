import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { ApiTokensService } from "./api-tokens.service.js";
import { AUTH_COOKIE_NAME } from "./auth-cookie.constants.js";

export interface AuthenticatedRequest extends Request {
  apiToken: { id: string; name: string };
}

/**
 * Guards every protected route by reading the long-lived API token straight
 * out of an httpOnly cookie - no separate session layer. The token IS the
 * credential; the cookie just keeps it out of reach of JS running on the
 * page (the only actual requirement here - see plan §2.1's revised approach).
 * A bearer `Authorization` header also works, for curl/CLI/API-client use.
 */
@Injectable()
export class ApiTokenAuthGuard implements CanActivate {
  constructor(private readonly apiTokensService: ApiTokensService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const plaintext = this.extractToken(request);
    if (!plaintext) {
      throw new UnauthorizedException("No token provided");
    }

    const token = await this.apiTokensService.findActiveByPlaintext(plaintext);
    if (!token) {
      throw new UnauthorizedException("Invalid or revoked token");
    }

    request.apiToken = { id: token.id, name: token.name };
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const cookieToken = (request.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE_NAME];
    if (cookieToken) return cookieToken;

    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) return authHeader.slice("Bearer ".length);

    return undefined;
  }
}
