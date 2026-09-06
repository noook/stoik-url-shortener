import { describe, it, expect } from "vitest";
import { computeLinkStatus } from "./link-status.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const PAST = new Date("2026-01-01T00:00:00.000Z");
const FUTURE = new Date("2027-01-01T00:00:00.000Z");

describe("computeLinkStatus", () => {
  it("is inactive when isActive is false, regardless of dates", () => {
    expect(computeLinkStatus({ isActive: false, startAt: null, endAt: null, now: NOW })).toBe("inactive");
    expect(computeLinkStatus({ isActive: false, startAt: PAST, endAt: FUTURE, now: NOW })).toBe("inactive");
    // Even a link that would otherwise read as "expired" is "inactive" first -
    // isActive is checked before either date, per the function's own order.
    expect(computeLinkStatus({ isActive: false, startAt: PAST, endAt: PAST, now: NOW })).toBe("inactive");
  });

  it("is active when isActive is true and no dates are set", () => {
    expect(computeLinkStatus({ isActive: true, startAt: null, endAt: null, now: NOW })).toBe("active");
  });

  it("is scheduled when startAt is in the future", () => {
    expect(computeLinkStatus({ isActive: true, startAt: FUTURE, endAt: null, now: NOW })).toBe("scheduled");
  });

  it("is active, not scheduled, exactly at startAt (boundary is inclusive)", () => {
    expect(computeLinkStatus({ isActive: true, startAt: NOW, endAt: null, now: NOW })).toBe("active");
  });

  it("is expired when endAt is in the past", () => {
    expect(computeLinkStatus({ isActive: true, startAt: null, endAt: PAST, now: NOW })).toBe("expired");
  });

  it("is active, not expired, exactly at endAt (boundary is inclusive)", () => {
    expect(computeLinkStatus({ isActive: true, startAt: null, endAt: NOW, now: NOW })).toBe("active");
  });

  it("is active when now falls between startAt and endAt", () => {
    expect(computeLinkStatus({ isActive: true, startAt: PAST, endAt: FUTURE, now: NOW })).toBe("active");
  });

  it("checks startAt (scheduled) before endAt (expired) when both would otherwise apply", () => {
    // startAt in the future AND endAt in the past is a contradictory window,
    // but the function's own branch order (checked in computeLinkStatus)
    // decides scheduled wins - documents that order rather than assuming it.
    expect(computeLinkStatus({ isActive: true, startAt: FUTURE, endAt: PAST, now: NOW })).toBe("scheduled");
  });

  it("defaults `now` to the real current time when not provided", () => {
    const farFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
    expect(computeLinkStatus({ isActive: true, startAt: farFuture, endAt: null })).toBe("scheduled");
  });
});
