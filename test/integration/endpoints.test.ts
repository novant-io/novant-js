//
// Copyright (c) 2026, Novant LLC
// Licensed under the MIT License
//
// Integration tests against the live API. These are read-only and
// verify response shape rather than specific values.
//

import { beforeAll, describe, expect, it } from "vitest";
import { anySourceId, client, testKey } from "./setup.js";

describe.skipIf(!testKey)("endpoints (live)", () => {
  let projId: number;
  let sourceId: string | undefined;

  beforeAll(async () => {
    projId = (await client.project()).proj_id;
    sourceId = await anySourceId();
  });

  it("project", async () => {
    const p = await client.project();
    expect(typeof p.proj_id).toBe("number");
    expect(typeof p.proj_name).toBe("string");
    expect(typeof p.area).toBe("number");
    expect(typeof p.tz).toBe("string");
    expect(typeof p.max_trend_years).toBe("number");
    expect(["read", "edit", "control"]).toContain(p.access);
  });

  it("project with own proj_id", async () => {
    expect((await client.zones({ proj_id: projId })).proj_id).toBe(projId);
  });

  it("assets", async () => {
    const res = await client.assets();
    expect(res.proj_id).toBe(projId);
    expect(typeof res.currency).toBe("string");
    for (const a of res.assets) {
      expect(typeof a.id).toBe("string");
      expect(typeof a.name).toBe("string");
      expect(typeof a.type).toBe("string");
    }
  });

  it("spaces", async () => {
    const res = await client.spaces();
    expect(res.proj_id).toBe(projId);
    for (const s of res.spaces) {
      expect(typeof s.id).toBe("string");
      expect(typeof s.name).toBe("string");
      if (s.parent_zone_ids) expect(Array.isArray(s.parent_zone_ids)).toBe(true);
    }
  });

  it("zones", async () => {
    const res = await client.zones();
    expect(res.proj_id).toBe(projId);
    for (const z of res.zones) {
      expect(typeof z.id).toBe("string");
      expect(typeof z.type).toBe("string");
    }
  });

  it("sources", async () => {
    const res = await client.sources();
    expect(res.proj_id).toBe(projId);
    for (const s of res.sources) {
      expect(typeof s.id).toBe("string");
      expect(typeof s.enabled).toBe("boolean");
      expect(typeof s.bound).toBe("boolean");
    }
    const bound = await client.sources({ bound_only: true });
    for (const s of bound.sources) expect(s.bound).toBe(true);
  });

  it("sourceMaps", async () => {
    const res = await client.sourceMaps();
    expect(res.proj_id).toBe(projId);
    for (const m of res.source_maps) {
      expect(typeof m.id).toBe("string");
      expect(typeof m.num_bound).toBe("number");
      for (const p of m.points) expect(typeof p.id).toBe("number");
    }
  });

  it("points by source", async (ctx) => {
    if (!sourceId) return ctx.skip();
    const res = await client.points({ source_id: sourceId });
    expect(res.proj_id).toBe(projId);
    expect(res.source_id).toBe(sourceId);
    for (const p of res.points) {
      expect(p.id.startsWith(sourceId + ".")).toBe(true);
      expect(["num", "bool", "enum"]).toContain(p.kind);
      expect(typeof p.writable).toBe("boolean");
    }
  });

  it("points and values by space", async (ctx) => {
    const spaces = (await client.spaces()).spaces;
    if (spaces.length === 0) return ctx.skip();
    const spaceId = spaces[0].id;
    expect((await client.points({ space_id: spaceId })).space_id).toBe(spaceId);
    expect((await client.values({ space_id: spaceId })).space_id).toBe(spaceId);
  });

  it("values by source", async (ctx) => {
    if (!sourceId) return ctx.skip();
    const res = await client.values({ source_id: sourceId });
    expect(res.proj_id).toBe(projId);
    for (const v of res.values) {
      expect(typeof v.id).toBe("string");
      expect(["ok", "fault", "unknown"]).toContain(v.status);
      expect(v.val === null || v.val === "na" || typeof v.val === "number").toBe(true);
    }
  });

  it("values by source_ids", async (ctx) => {
    if (!sourceId) return ctx.skip();
    const res = await client.values({ source_ids: [sourceId] });
    expect(res.source_ids).toEqual([sourceId]);
  });

  it("trends", async (ctx) => {
    if (!sourceId) return ctx.skip();
    const points = (await client.points({ source_id: sourceId })).points;
    if (points.length === 0) return ctx.skip();
    const today = new Date().toISOString().slice(0, 10);
    const res = await client.trends({ point_ids: [points[0].id], date: today });
    expect(res.proj_id).toBe(projId);
    expect(res.point_ids).toEqual([points[0].id]);
    for (const row of res.trends) expect(typeof row.ts).toBe("string");
  });

  it("scenes and schedules", async () => {
    expect((await client.scenes()).proj_id).toBe(projId);
    expect((await client.schedules()).proj_id).toBe(projId);
  });

  it("explorer ops / sources / points", async () => {
    expect(Array.isArray((await client.explorerOps()).ops)).toBe(true);
    const sources = (await client.explorerSources()).sources;
    const learned = sources.find((s) => s.last_learn);
    if (learned) {
      const res = await client.explorerPoints(learned.id);
      expect(res.source.id).toBe(learned.id);
    }
  });
});
