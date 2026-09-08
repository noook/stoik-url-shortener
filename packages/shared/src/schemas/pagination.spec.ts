import { describe, it, expect } from "vitest";
import { paginationQuerySchema } from "./pagination.js";

describe("paginationQuerySchema", () => {
  it("defaults page to 1 and pageSize to 20 when omitted", () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("coerces querystring values to numbers", () => {
    expect(paginationQuerySchema.parse({ page: "3", pageSize: "50" })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it("rejects page below 1", () => {
    expect(() => paginationQuerySchema.parse({ page: "0" })).toThrow();
  });

  it("rejects pageSize above 100", () => {
    expect(() => paginationQuerySchema.parse({ pageSize: "101" })).toThrow();
  });

  it("rejects non-numeric values instead of silently falling back", () => {
    expect(() => paginationQuerySchema.parse({ page: "abc" })).toThrow();
  });

  it("rejects decimal values", () => {
    expect(() => paginationQuerySchema.parse({ page: "1.5" })).toThrow();
  });
});
