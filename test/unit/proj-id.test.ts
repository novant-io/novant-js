//
// Copyright (c) 2026, Novant LLC
// Licensed under the MIT License
//
// Verify every project method honors proj_id (omitted, per call, client
// default, and override). Stubs fetch; does not hit the live API.
//

import { describe, expect, it } from "vitest";
import { NovantClient, type ProjOptions } from "../../src/index.js";
import { stubClient, type Call } from "./helpers.js";

type C = NovantClient;
type O = ProjOptions;

const CALLS: [string, (c: C, o?: O) => Promise<unknown>][] = [
  ["project",         (c, o) => c.project(o)],
  ["assets",          (c, o) => c.assets(o)],
  ["spaces",          (c, o) => c.spaces(o)],
  ["zones",           (c, o) => c.zones(o)],
  ["sources",         (c, o) => c.sources(o)],
  ["sourceMaps",      (c, o) => c.sourceMaps(o)],
  ["points",          (c, o) => c.points({ source_id: "s.1", ...o })],
  ["values",          (c, o) => c.values({ source_id: "s.1", ...o })],
  ["trends",          (c, o) => c.trends({ point_ids: ["s.1.1"], date: "2026-03-09", ...o })],
  ["scenes",          (c, o) => c.scenes(o)],
  ["schedules",       (c, o) => c.schedules(o)],
  ["write",           (c, o) => c.write("s.1.1", 1, o)],
  ["writeBatch",      (c, o) => c.writeBatch([{ point_id: "s.1.1", value: 1 }], o)],
  ["explorerScan",    (c, o) => c.explorerScan("bacnet-scan", { ...o })],
  ["explorerLearn",   (c, o) => c.explorerLearn("c1578fe370e4", o)],
  ["explorerOps",     (c, o) => c.explorerOps(o)],
  ["explorerSources", (c, o) => c.explorerSources(o)],
  ["explorerPoints",  (c, o) => c.explorerPoints("c1578fe370e4", o)],
  ["importZones",     (c, o) => c.importZones("x", o)],
  ["importSpaces",    (c, o) => c.importSpaces("x", o)],
  ["importAssets",    (c, o) => c.importAssets("x", o)],
  ["importSources",   (c, o) => c.importSources("x", o)],
  ["importSourceMap", (c, o) => c.importSourceMap("x", o)],
  ["importScene",     (c, o) => c.importScene("x", o)],
  ["importSchedules", (c, o) => c.importSchedules("x", o)],
  ["importTrends",    (c, o) => c.importTrends("x", o)],
];

/** proj_id sent on a request, from the query string or form body. */
function sentProjId(call: Call): string | null {
  const q = call.url.searchParams.get("proj_id");
  if (q !== null) return q;
  return call.body && call.method === "POST" && call.headers["Content-Type"] !== "text/csv"
    ? new URLSearchParams(call.body).get("proj_id")
    : null;
}

describe("proj_id on all project methods", () => {
  it("covers every public project method", () => {
    const methods = Object.getOwnPropertyNames(NovantClient.prototype)
      .filter((n) => n !== "constructor" && n !== "orgProjects");
    expect(new Set(methods)).toEqual(new Set(CALLS.map(([n]) => n)));
  });

  it.each(CALLS)("%s omits proj_id by default", async (_, call) => {
    const { client, last } = stubClient();
    await call(client);
    expect(sentProjId(last())).toBeNull();
  });

  it.each(CALLS)("%s sends per call proj_id", async (_, call) => {
    const { client, last } = stubClient();
    await call(client, { proj_id: 4821 });
    expect(sentProjId(last())).toBe("4821");
  });

  it.each(CALLS)("%s sends client default proj_id", async (_, call) => {
    const { client, last } = stubClient({}, 200, { projId: 4821 });
    await call(client);
    expect(sentProjId(last())).toBe("4821");
  });

  it.each(CALLS)("%s per call overrides client default", async (_, call) => {
    const { client, last } = stubClient({}, 200, { projId: 4821 });
    await call(client, { proj_id: 5307 });
    expect(sentProjId(last())).toBe("5307");
  });

  it("does not leak between calls", async () => {
    const { client, query } = stubClient({}, 200, { projId: 4821 });
    await client.zones({ proj_id: 5307 });
    await client.zones();
    expect(query()).toEqual({ proj_id: "4821" });
  });

  it("orgProjects ignores client default proj_id", async () => {
    const { client, query } = stubClient({ projects: [] }, 200, { projId: 4821 });
    await client.orgProjects();
    expect(query()).toEqual({});
  });
});
