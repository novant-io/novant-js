//
// Copyright (c) 2026, Novant LLC
// Licensed under the MIT License
//
// Unit tests for schedule-string parsing and active-state evaluation.
//

import { describe, expect, it } from "vitest";
import { parseSchedule, scheduleActive, type Schedule } from "../../src/index.js";

const SCHED: Schedule = {
  id: "sch.1",
  name: "Business Hours",
  schedule: "weekdays 8:00-17:00, sat 9:00-12:00",
  active_mode_ids: ["sn.1.1", "sn.2.1"],
  inactive_mode_ids: ["sn.1.2", "sn.2.2"],
};

// local wall-clock dates (runtime tz) for the reference weekdays
const WED = (h: number, m: number) => new Date(2026, 5, 24, h, m);
const SAT = (h: number, m: number) => new Date(2026, 5, 27, h, m);
const SUN = (h: number, m: number) => new Date(2026, 5, 28, h, m);

const active = (now: Date, toleranceMs?: number) => scheduleActive(SCHED, { now, toleranceMs });

describe("parseSchedule", () => {
  it("decodes rules", () => {
    expect(parseSchedule(SCHED.schedule)).toEqual([
      { start_day: 1, end_day: 5, start: 8 * 60, end: 17 * 60 },
      { start_day: 6, end_day: 6, start: 9 * 60, end: 12 * 60 },
    ]);
  });

  it("decodes wrapping day ranges", () => {
    expect(parseSchedule("fri-mon 8:00-9:00")).toEqual([
      { start_day: 5, end_day: 1, start: 480, end: 540 },
    ]);
  });

  it.each([
    "",                     // empty
    "weekdays",             // missing time range
    "funday 8:00-9:00",     // bad weekday
    "weekdays 8-9",         // bad time format
    "weekdays 25:00-9:00",  // hour out of range
    "weekdays 8:60-9:00",   // minute out of range
  ])("rejects invalid '%s'", (bad) => {
    expect(() => parseSchedule(bad)).toThrow();
  });
});

describe("scheduleActive", () => {
  it("active within weekday window", () => {
    expect(active(WED(10, 0))).toBe(true);
  });

  it("inactive before start and at exclusive end", () => {
    expect(active(WED(7, 59))).toBe(false);
    expect(active(WED(17, 0))).toBe(false);
  });

  it("active within saturday window", () => {
    expect(active(SAT(10, 0))).toBe(true);
    expect(active(SAT(12, 0))).toBe(false);
  });

  it("inactive on unscheduled day", () => {
    expect(active(SUN(10, 0))).toBe(false);
  });

  it("defaults to now", () => {
    expect(typeof scheduleActive(SCHED)).toBe("boolean");
  });

  it("accepts a raw schedule string", () => {
    expect(scheduleActive("wed 9:00-10:00", { now: WED(9, 30) })).toBe(true);
  });

  it("tolerance shifts start earlier but not end", () => {
    const tol = 30 * 60_000;
    expect(active(WED(7, 30))).toBe(false);
    expect(active(WED(7, 30), tol)).toBe(true);
    expect(active(WED(7, 29), tol)).toBe(false);
    expect(active(WED(17, 0), tol)).toBe(false);
  });

  it("tolerance pulls next day's window across midnight", () => {
    // thu 0:00-1:00 with 30m tolerance is active at wed 23:45
    expect(scheduleActive("thu 0:00-1:00", { now: WED(23, 45), toleranceMs: 30 * 60_000 })).toBe(true);
    expect(scheduleActive("thu 0:00-1:00", { now: WED(23, 15), toleranceMs: 30 * 60_000 })).toBe(false);
  });

  it("day range wraps across weekend", () => {
    const s = "fri-mon 8:00-9:00";
    expect(scheduleActive(s, { now: SAT(8, 30) })).toBe(true);
    expect(scheduleActive(s, { now: SUN(8, 30) })).toBe(true);
    expect(scheduleActive(s, { now: new Date(2026, 5, 29, 8, 30) })).toBe(true);  // mon
    expect(scheduleActive(s, { now: WED(8, 30) })).toBe(false);
  });

  it("evaluates in a novant or iana timezone", () => {
    // 2026-06-24T14:00Z is Wed 10:00 in New York (EDT) and 23:00 in Tokyo
    const now = new Date("2026-06-24T14:00:00Z");
    expect(scheduleActive(SCHED, { now, tz: "New_York" })).toBe(true);
    expect(scheduleActive(SCHED, { now, tz: "America/New_York" })).toBe(true);
    expect(scheduleActive(SCHED, { now, tz: "Tokyo" })).toBe(false);
    expect(scheduleActive(SCHED, { now, tz: "UTC" })).toBe(true);  // wed 14:00
  });

  it("rejects unknown timezones", () => {
    expect(() => scheduleActive(SCHED, { tz: "Nowhere" })).toThrow("Unknown timezone");
  });
});
