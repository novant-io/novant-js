//
// Copyright (c) 2026, Novant LLC
// Licensed under the MIT License
//
// Unit tests for request encoding. These stub fetch and do not hit the
// live API.
//

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NovantClient, NovantError, VERSION } from "../../src/index.js";
import { stubClient } from "./helpers.js";

describe("client", () => {
  it("requires an api key", () => {
    expect(() => new NovantClient({ apiKey: "" })).toThrow("apiKey is required");
  });

  it("version matches package.json", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    expect(VERSION).toBe(pkg.version);
  });

  it("sends auth, gzip, and user agent headers", async () => {
    const { client, last } = stubClient();
    await client.project();
    const h = last().headers;
    expect(h["Authorization"]).toBe("Basic " + btoa("ak_test:"));
    expect(h["Accept-Encoding"]).toBe("gzip");
    expect(h["User-Agent"]).toBe(`novant-js/${VERSION}`);
  });

  it("uses default and custom base urls", async () => {
    const a = stubClient();
    await a.client.project();
    expect(a.last().url.href).toBe("https://api.novant.io/v1/project");

    const b = stubClient({}, 200, { baseUrl: "http://localhost:8080/v1/" });
    await b.client.project();
    expect(b.last().url.href).toBe("http://localhost:8080/v1/project");
  });

  it("returns the response json unchanged", async () => {
    const resp = { proj_id: 7, assets: [{ id: "a.1", future_field: 1 }] };
    const { client } = stubClient(resp);
    expect(await client.assets()).toEqual(resp);
  });
});

describe("proj_id", () => {
  it("is omitted by default", async () => {
    const { client, query } = stubClient();
    await client.zones();
    expect(query()).toEqual({});
  });

  it("uses the client default", async () => {
    const { client, query } = stubClient({}, 200, { projId: 4821 });
    await client.zones();
    expect(query()).toEqual({ proj_id: "4821" });
  });

  it("per call overrides the client default", async () => {
    const { client, query } = stubClient({}, 200, { projId: 4821 });
    await client.zones({ proj_id: 99 });
    expect(query()).toEqual({ proj_id: "99" });
  });

  it("is sent in the form body for posts", async () => {
    const { client, form } = stubClient({}, 200, { projId: 4821 });
    await client.write("s.1.1", 72);
    expect(form().proj_id).toBe("4821");
  });

  it("is sent in the query string for imports", async () => {
    const { client, query } = stubClient({}, 200, { projId: 4821 });
    await client.importZones("id,name\n");
    expect(query()).toEqual({ proj_id: "4821" });
  });
});

describe("read endpoints", () => {
  it("orgProjects", async () => {
    const { client, last } = stubClient({ projects: [] });
    await client.orgProjects();
    expect(last().method).toBe("GET");
    expect(last().url.pathname).toBe("/v1/org/projects");
  });

  it.each([
    ["assets", "/v1/assets", { asset_ids: ["a.1", "a.2"] }, { asset_ids: "a.1,a.2" }],
    ["spaces", "/v1/spaces", { space_ids: ["sp.1"] }, { space_ids: "sp.1" }],
    ["zones", "/v1/zones", { zone_ids: ["z.1", "z.2"] }, { zone_ids: "z.1,z.2" }],
    ["sourceMaps", "/v1/source-maps", { source_map_ids: ["sm.1"] }, { source_map_ids: "sm.1" }],
    ["scenes", "/v1/scenes", { scene_id: "sn.1" }, { scene_id: "sn.1" }],
    ["schedules", "/v1/schedules", { schedule_id: "sch.1" }, { schedule_id: "sch.1" }],
  ] as const)("%s", async (method, path, opts, expected) => {
    const { client, last, query } = stubClient();
    await (client as any)[method]();
    expect(last().method).toBe("GET");
    expect(last().url.pathname).toBe(path);
    expect(query()).toEqual({});
    await (client as any)[method](opts);
    expect(query()).toEqual(expected);
  });

  it("sources", async () => {
    const { client, query } = stubClient();
    await client.sources({ bound_only: false });
    expect(query()).toEqual({});
    await client.sources({ source_ids: ["s.1", "s.2"], bound_only: true });
    expect(query()).toEqual({ source_ids: "s.1,s.2", bound_only: "true" });
  });

  it("points", async () => {
    const { client, last, query } = stubClient();
    await client.points({ space_id: "sp.1", point_types: ["zone_temp", "zone_sp"], point_ids: ["s.1.1"] });
    expect(last().url.pathname).toBe("/v1/points");
    expect(query()).toEqual({ space_id: "sp.1", point_types: "zone_temp,zone_sp", point_ids: "s.1.1" });
  });

  it("values", async () => {
    const { client, last, query } = stubClient();
    await client.values({ source_ids: ["s.1", "s.2"], point_ids: ["s.1.1"] });
    expect(last().url.pathname).toBe("/v1/values");
    expect(query()).toEqual({ source_ids: "s.1,s.2", point_ids: "s.1.1" });
  });

  it("trends with date takes precedence over start/end", async () => {
    const { client, last, query } = stubClient();
    await client.trends({ point_ids: ["s.1.1", "s.1.2"], date: "2026-03-09", start_date: "2026-01-01", end_date: "2026-01-02" });
    expect(last().url.pathname).toBe("/v1/trends");
    expect(query()).toEqual({ point_ids: "s.1.1,s.1.2", date: "2026-03-09" });
  });

  it("trends with range and options", async () => {
    const { client, query } = stubClient();
    await client.trends({ point_ids: ["s.1.1"], start_date: "2026-01-01", end_date: "2026-01-31", tz: "Chicago", interval: "1hr", aggregate: "max" });
    expect(query()).toEqual({
      point_ids: "s.1.1", start_date: "2026-01-01", end_date: "2026-01-31",
      tz: "Chicago", interval: "1hr", aggregate: "max",
    });
  });
});

describe("write", () => {
  it("writes a value", async () => {
    const { client, last, form } = stubClient({ proj_id: 1, status: "ok" });
    const res = await client.write("s.1.1", 72.5, { level: 8, expires: "1hr" });
    expect(res.status).toBe("ok");
    expect(last().method).toBe("POST");
    expect(last().url.pathname).toBe("/v1/write");
    expect(last().headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(form()).toEqual({ point_id: "s.1.1", value: "72.5", level: "8", expires: "1hr" });
  });

  it("writes null to clear a hold", async () => {
    const { client, form } = stubClient();
    await client.write("s.1.1", null);
    expect(form()).toEqual({ point_id: "s.1.1", value: "null" });
  });

  it("writeBatch encodes indexed entries", async () => {
    const { client, form } = stubClient();
    await client.writeBatch([
      { point_id: "s.1.1", value: 1 },
      { point_id: "s.1.2", value: null, level: 10, expires: "30min" },
    ]);
    expect(form()).toEqual({
      "writes[0][point_id]": "s.1.1",
      "writes[0][value]": "1",
      "writes[1][point_id]": "s.1.2",
      "writes[1][value]": "null",
      "writes[1][level]": "10",
      "writes[1][expires]": "30min",
    });
  });

  it("writeBatch does not limit batch size client side", async () => {
    const { client, form } = stubClient();
    const writes = Array.from({ length: 50 }, (_, i) => ({ point_id: `s.1.${i}`, value: i }));
    await client.writeBatch(writes);
    expect(form()["writes[49][point_id]"]).toBe("s.1.49");
  });

  it("writeBatch validates entries", async () => {
    const { client, calls } = stubClient();
    await expect(client.writeBatch([])).rejects.toThrow("non-empty");
    await expect(client.writeBatch([{ value: 1 } as any])).rejects.toThrow("writes[0] missing required 'point_id'");
    await expect(client.writeBatch([{ point_id: "s.1.1", value: 1 }, { point_id: "s.1.2" } as any]))
      .rejects.toThrow("writes[1] missing required 'value'");
    expect(calls.length).toBe(0);
  });
});

describe("explorer", () => {
  it("explorerScan encodes op params", async () => {
    const { client, last, form } = stubClient({ proj_id: 1, status: "ok", op_id: "0a1b" });
    const res = await client.explorerScan("bacnet-find", { node_id: "nv100-1", ip_addrs: ["10.0.0.1", "10.0.0.2"], port: 47808 });
    expect(res.op_id).toBe("0a1b");
    expect(last().method).toBe("POST");
    expect(last().url.pathname).toBe("/v1/explorer/scan");
    expect(form()).toEqual({ op: "bacnet-find", node_id: "nv100-1", ip_addrs: "10.0.0.1,10.0.0.2", port: "47808" });
  });

  it("explorerScan encodes bools and skips undefined", async () => {
    const { client, form } = stubClient();
    await client.explorerScan("jasper-scan", { ip_addr: "10.0.0.5", credential: "niagara", tls: false, port: undefined });
    expect(form()).toEqual({ op: "jasper-scan", ip_addr: "10.0.0.5", credential: "niagara", tls: "false" });
  });

  it("explorerLearn", async () => {
    const { client, last, form } = stubClient();
    await client.explorerLearn("c1578fe370e4", { node_id: "nv100-1" });
    expect(last().url.pathname).toBe("/v1/explorer/learn");
    expect(form()).toEqual({ source_id: "c1578fe370e4", node_id: "nv100-1" });
  });

  it("explorerOps / explorerSources / explorerPoints", async () => {
    const { client, last, query } = stubClient();
    await client.explorerOps();
    expect(last().url.pathname).toBe("/v1/explorer/ops");
    await client.explorerSources();
    expect(last().url.pathname).toBe("/v1/explorer/sources");
    await client.explorerPoints("c1578fe370e4");
    expect(last().method).toBe("GET");
    expect(last().url.pathname).toBe("/v1/explorer/points");
    expect(query()).toEqual({ source_id: "c1578fe370e4" });
  });
});

describe("import", () => {
  it.each([
    ["importZones", "/v1/import/zones"],
    ["importSpaces", "/v1/import/spaces"],
    ["importAssets", "/v1/import/assets"],
    ["importSources", "/v1/import/sources"],
    ["importSourceMap", "/v1/import/source-map"],
    ["importScene", "/v1/import/scene"],
    ["importSchedules", "/v1/import/schedules"],
    ["importTrends", "/v1/import/trends"],
  ] as const)("%s posts csv", async (method, path) => {
    const { client, last } = stubClient();
    await client[method]("id,name\nz.1,Zone 1\n");
    expect(last().method).toBe("POST");
    expect(last().url.pathname).toBe(path);
    expect(last().headers["Content-Type"]).toBe("text/csv");
    expect(last().body).toBe("id,name\nz.1,Zone 1\n");
  });

  it("accepts Uint8Array csv", async () => {
    const { client, last } = stubClient();
    await client.importZones(new TextEncoder().encode("id,name\n"));
    expect(last().body).toBe("id,name\n");
  });

  it("importTrends sends mode in query string", async () => {
    const { client, query } = stubClient();
    await client.importTrends("ts,s.1.1\n", { mode: "append", proj_id: 5 });
    expect(query()).toEqual({ proj_id: "5", mode: "append" });
  });
});

describe("errors", () => {
  it("throws NovantError with api msg", async () => {
    const { client } = stubClient({ msg: "API key does not have required permissions." }, 403);
    const err = await client.write("s.1.1", 1).catch((e) => e);
    expect(err).toBeInstanceOf(NovantError);
    expect(err.status).toBe(403);
    expect(err.message).toBe("API key does not have required permissions.");
    expect(err.body).toEqual({ msg: "API key does not have required permissions." });
  });

  it("falls back to HTTP status for non-json bodies", async () => {
    const { client } = stubClient("<html>Bad Gateway</html>", 502);
    const err = await client.project().catch((e) => e);
    expect(err).toBeInstanceOf(NovantError);
    expect(err.status).toBe(502);
    expect(err.message).toBe("HTTP 502");
    expect(err.body).toBeUndefined();
  });
});

describe("typedef", () => {
  it.each([
    ["typedefZones", "/v1/typedef/zones"],
    ["typedefSpaces", "/v1/typedef/spaces"],
    ["typedefAssets", "/v1/typedef/assets"],
    ["typedefPoints", "/v1/typedef/points"],
  ] as const)("%s", async (method, path) => {
    const resp = {
      types: [{ id: "mech.ahu", name: "Air Handling Unit", desc: "...", service: "mech", ontology: { brick: "AHU", dbo: "AHU" } }],
      props: [{ id: "meter_scope", name: "Meter Scope", type: "text", values: ["utility"], on: ["elec.meter"], desc: "..." }],
    };
    const { client, last, query } = stubClient(resp);
    expect(await client[method]()).toEqual(resp);
    expect(last().method).toBe("GET");
    expect(last().url.pathname).toBe(path);
    expect(query()).toEqual({});
  });
});
