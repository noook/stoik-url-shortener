import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";

export interface SessionPayload {
  tokenId: string;
  issuedAt: number;
}

/**
 * Signed opaque session cookie (see plan §2.1): no `sessions` table needed.
 * The cookie value is `<base64url(payload)>.<hmac>` - if the HMAC doesn't match
 * (tampered or wrong secret) it's rejected outright.
 */
@Injectable()
export class SessionCodec {
  private readonly secret: string;

  constructor(configService: ConfigService) {
    this.secret = configService.getOrThrow<string>("SESSION_SECRET");
  }

  encode(payload: SessionPayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = this.sign(body);
    return `${body}.${signature}`;
  }

  decode(cookieValue: string | undefined): SessionPayload | null {
    if (!cookieValue) return null;
    const [body, signature] = cookieValue.split(".");
    if (!body || !signature) return null;

    const expectedSignature = this.sign(body);
    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      return null;
    }

    try {
      return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    } catch {
      return null;
    }
  }

  private sign(body: string): string {
    return createHmac("sha256", this.secret).update(body).digest("base64url");
  }
}
