import { describe, it, expect } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "./zod-validation.pipe.js";

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

describe("ZodValidationPipe", () => {
  it("returns the parsed value unchanged for valid input", () => {
    const pipe = new ZodValidationPipe(testSchema);
    const result = pipe.transform({ name: "Ada", age: 30 });
    expect(result).toEqual({ name: "Ada", age: 30 });
  });

  it("strips fields not defined in the schema (Zod's default object behavior)", () => {
    const pipe = new ZodValidationPipe(testSchema);
    const result = pipe.transform({ name: "Ada", age: 30, extra: "ignored" });
    expect(result).toEqual({ name: "Ada", age: 30 });
  });

  it("throws BadRequestException for invalid input", () => {
    const pipe = new ZodValidationPipe(testSchema);
    expect(() => pipe.transform({ name: "", age: -1 })).toThrow(BadRequestException);
  });

  it("throws BadRequestException with the Zod issues attached, not just a generic message", () => {
    const pipe = new ZodValidationPipe(testSchema);
    try {
      pipe.transform({ name: "", age: -1 });
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as { message: string; issues: unknown[] };
      expect(response.message).toBe("Validation failed");
      expect(response.issues.length).toBeGreaterThan(0);
    }
  });

  it("throws for a completely wrong shape (e.g. an array instead of an object)", () => {
    const pipe = new ZodValidationPipe(testSchema);
    expect(() => pipe.transform(["not", "an", "object"])).toThrow(BadRequestException);
  });

  it("throws for missing required fields", () => {
    const pipe = new ZodValidationPipe(testSchema);
    expect(() => pipe.transform({ name: "Ada" })).toThrow(BadRequestException);
  });
});
