//
// Copyright (c) 2026, Novant LLC
// Licensed under the MIT License
//
// Integration tests for org keys against the live API (read-only).
//

import { beforeAll, describe, expect, it } from "vitest";
import { NovantClient, NovantError } from "../../src/index.js";
import { client, orgClient, testKey, testOrgKey } from "./setup.js";

describe.skipIf(!testKey)("project key (live)", () => {
  it("rejects another project's proj_id", async () => {
    const projId = (await client.project()).proj_id;
    const err = await client.zones({ proj_id: projId + 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(NovantError);
    expect([403, 404]).toContain(err.status);
  });

  it("orgProjects rejects project key", async () => {
    const err = await client.orgProjects().catch((e) => e);
    expect(err).toBeInstanceOf(NovantError);
    expect(err.status).toBe(403);
    expect(err.message).toBe("This endpoint requires an organization API key.");
  });
});

describe.skipIf(!testKey || !testOrgKey)("org key (live)", () => {
  let projId: number;

  beforeAll(async () => {
    projId = (await client.project()).proj_id;
  });

  it("requires proj_id", async () => {
    const err = await orgClient.zones().catch((e) => e);
    expect(err).toBeInstanceOf(NovantError);
    expect(err.status).toBe(400);
    expect(err.message).toBe("Organization API keys require proj_id argument.");
  });

  it("per call proj_id", async () => {
    expect((await orgClient.project({ proj_id: projId })).proj_id).toBe(projId);
    expect((await orgClient.zones({ proj_id: projId })).proj_id).toBe(projId);
  });

  it("client default projId", async () => {
    const c = new NovantClient({ apiKey: testOrgKey!, projId });
    expect((await c.zones()).proj_id).toBe(projId);
    expect((await c.explorerOps()).proj_id).toBe(projId);
  });

  it("unknown proj_id", async () => {
    const err = await orgClient.zones({ proj_id: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(NovantError);
    expect(err.status).toBe(404);
  });

  it("orgProjects", async () => {
    const res = await orgClient.orgProjects();
    expect(res.projects.length).toBeGreaterThan(0);
    for (const p of res.projects) {
      expect(typeof p.proj_id).toBe("number");
      expect(typeof p.proj_name).toBe("string");
      expect(typeof p.city).toBe("string");
      expect(typeof p.tz).toBe("string");
      expect(p.area === undefined || typeof p.area === "number").toBe(true);
    }
    expect(res.projects.find((p) => p.proj_id === projId)).toBeDefined();
  });
});
