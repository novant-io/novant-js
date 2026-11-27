//
// Copyright (c) 2026, Novant LLC
// Licensed under the MIT License
//
// Schedule string parsing and active-state evaluation.
//

import type { Schedule } from "./types.js";

/////////////////////////////////////////////////////////////////////////
// Types
/////////////////////////////////////////////////////////////////////////

/**
 * A single "<days> hh:mm-hh:mm" occupancy rule.
 *
 * Days are a contiguous weekday range (start_day..end_day) using JS
 * `Date.getDay()` ordinals (0=Sun .. 6=Sat). The range may wrap across
 * the week, i.e. fri-mon covers Fri, Sat, Sun, Mon. Times are minutes
 * since midnight; start is inclusive and end is exclusive.
 */
export interface ScheduleRule {
  start_day: number;
  end_day: number;
  start: number;
  end: number;
}

/** Options for `scheduleActive()`. */
export interface ScheduleActiveOptions {
  /** Time to evaluate (defaults to now). */
  now?: Date;

  /**
   * Timezone to evaluate `now` in: a Novant project tz (i.e. "New_York")
   * or an IANA name (i.e. "America/New_York"). Pass the project `tz` to
   * evaluate in project local time. Defaults to the runtime local time.
   */
  tz?: string;

  /**
   * Widens each rule's window directionally: the start is shifted earlier
   * by this many milliseconds while the end is left unchanged.
   */
  toleranceMs?: number;
}

/////////////////////////////////////////////////////////////////////////
// Parse
/////////////////////////////////////////////////////////////////////////

const WEEKDAYS: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

/**
 * Parse a schedule string, i.e. "weekdays 8:00-17:00, sat 9:00-12:00",
 * into a list of rules. Throws if the string is invalid.
 */
export function parseSchedule(s: string): ScheduleRule[] {
  return s.split(",").map((seg) => parseRule(seg.trim()));
}

function parseRule(seg: string): ScheduleRule {
  const tokens = seg.split(/\s+/);
  if (tokens.length !== 2) throw new Error(`Invalid schedule item: '${seg}'`);
  const [days, range] = tokens;

  const startEnd = range.split("-");
  if (startEnd.length !== 2) throw new Error(`Invalid time range: '${range}'`);
  const start = parseTime(startEnd[0]);
  const end = parseTime(startEnd[1]);

  if (days.toLowerCase() === "weekdays") {
    return { start_day: WEEKDAYS.mon, end_day: WEEKDAYS.fri, start, end };
  }
  const dash = days.indexOf("-");
  if (dash >= 0) {
    return {
      start_day: parseWeekday(days.slice(0, dash)),
      end_day: parseWeekday(days.slice(dash + 1)),
      start,
      end,
    };
  }
  const d = parseWeekday(days);
  return { start_day: d, end_day: d, start, end };
}

/** Parse a strict 24hr 'h:mm' or 'hh:mm' time to minutes since midnight. */
function parseTime(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) throw new Error(`Invalid time: ${s}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`Invalid time: ${s}`);
  return h * 60 + min;
}

function parseWeekday(s: string): number {
  const d = WEEKDAYS[s.toLowerCase()];
  if (d === undefined) throw new Error(`Invalid weekday: ${s}`);
  return d;
}

/////////////////////////////////////////////////////////////////////////
// Active
/////////////////////////////////////////////////////////////////////////

/**
 * Return true if the schedule is active (occupied) at `opts.now`.
 * Accepts a `Schedule` from `schedules()` or a raw schedule string.
 */
export function scheduleActive(schedule: Schedule | string, opts: ScheduleActiveOptions = {}): boolean {
  const str = typeof schedule === "string" ? schedule : schedule.schedule;
  const rules = parseSchedule(str);
  const { day, minutes } = wallClock(opts.now ?? new Date(), opts.tz);
  const tol = (opts.toleranceMs ?? 0) / 60_000;
  return rules.some((r) => ruleMatches(r, day, minutes, tol));
}

function ruleMatches(r: ScheduleRule, day: number, minutes: number, tol: number): boolean {
  // check today and tomorrow: a start shifted back by tolerance may
  // pull the next day's window into the current day
  for (const offset of [0, 1]) {
    if (!dayContains(r, (day + offset) % 7)) continue;
    const start = r.start + offset * 1440 - tol;
    const end = r.end + offset * 1440;
    if (start <= minutes && minutes < end) return true;
  }
  return false;
}

function dayContains(r: ScheduleRule, d: number): boolean {
  if (r.start_day <= r.end_day) return r.start_day <= d && d <= r.end_day;
  return d >= r.start_day || d <= r.end_day;
}

/** Weekday and fractional minutes since midnight of `date` in `tz`. */
function wallClock(date: Date, tz?: string): { day: number; minutes: number } {
  if (tz === undefined) {
    return {
      day: date.getDay(),
      minutes: date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60,
    };
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: toIanaTz(tz),
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    day: WEEKDAYS[get("weekday").toLowerCase()],
    minutes: Number(get("hour")) * 60 + Number(get("minute")) + Number(get("second")) / 60,
  };
}

/**
 * Map a Novant timezone name (i.e. "New_York") to an IANA name
 * (i.e. "America/New_York"). IANA names are returned unchanged.
 */
function toIanaTz(tz: string): string {
  if (tz.includes("/") || tz === "UTC") return tz;
  const match = Intl.supportedValuesOf("timeZone").find((z) => z.endsWith("/" + tz));
  if (!match) throw new Error(`Unknown timezone: ${tz}`);
  return match;
}
