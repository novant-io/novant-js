//
// Copyright (c) 2026, Novant LLC
// Licensed under the MIT License
//
// Integration tests for typedef endpoints against the live API. These
// are not project scoped, so they also run with an org key and no proj_id.
//

import { describe, expect, it } from "vitest";
import type { TypedefList } from "../../src/index.js";
import { client, orgClient, testKey, testOrgKey } from "./setup.js";

function checkShape(res: TypedefList) {
  expect(res.types.length).toBeGreaterThan(0);
  for (const t of res.types) {
    expect(typeof t.id).toBe("string");
    expect(typeof t.name).toBe("string");
    expect(typeof t.desc).toBe("string");
    expect(typeof t.ontology).toBe("object");
  }
  for (const p of res.props) {
    expect(typeof p.id).toBe("string");
    expect(typeof p.type).toBe("string");
    expect(Array.isArray(p.on)).toBe(true);
  }
}

describe.skipIf(!testKey)("typedef (live)", () => {
  it("zones have types and no props", async () => {
    const res = await client.typedefZones();
    checkShape(res);
    expect(res.props).toEqual([]);
  });

  it("spaces", async () => checkShape(await client.typedefSpaces()));
  it("assets", async () => checkShape(await client.typedefAssets()));
  it("points", async () => checkShape(await client.typedefPoints()));
});

describe.skipIf(!testOrgKey)("typedef with org key (live)", () => {
  it("does not require proj_id", async () => {
    checkShape(await orgClient.typedefPoints());
  });
});
