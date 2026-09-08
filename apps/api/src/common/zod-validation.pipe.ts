import { BadRequestException, Body, Injectable, Query, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * Validates request bodies/params against a shared Zod schema from
 * @url-shortener/shared - the same schema the React form uses with
 * react-hook-form's zodResolver, so validation logic lives in exactly one place.
 *
 * Generic over the schema's output type T so `transform` returns T instead of
 * `unknown` - see ZodBody/ZodQuery below, which is what actually gets that
 * type onto the controller method's parameter.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "Validation failed",
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}

/**
 * Combines @Body()/@Query() with the Zod pipe so the decorated parameter is
 * typed as the schema's inferred output (T), not `unknown`. Using @Body() +
 * a bare `new ZodValidationPipe(schema)` in @UsePipes still worked at
 * runtime, but left the handler parameter typed `unknown`, forcing an `as`
 * cast that threw away the type safety zod was supposed to provide.
 */
export const ZodBody = <T>(schema: ZodType<T>) => Body(new ZodValidationPipe(schema));
export const ZodQuery = <T>(schema: ZodType<T>) => Query(new ZodValidationPipe(schema));
