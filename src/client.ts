//
// Copyright (c) 2026, Novant LLC
// Licensed under the MIT License
//

import { NovantError } from "./error.js";
import { VERSION } from "./version.js";
import type {
  AssetList,
  ExplorerOpList,
  ExplorerOpResponse,
  ExplorerPointList,
  ExplorerSourceList,
  OrgProjectList,
  PointList,
  Project,
  SceneList,
  ScheduleList,
  SourceList,
  SourceMapList,
  SpaceList,
  StatusResponse,
  TrendData,
  TypedefList,
  ValueList,
  WriteEntry,
  ZoneList,
} from "./types.js";

/////////////////////////////////////////////////////////////////////////
// Options
/////////////////////////////////////////////////////////////////////////

// Allows any string while still offering autocomplete for known values,
// so new server-side values work without an SDK update.
type OpenString<T extends string> = T | (string & {});

/** Options for `new NovantClient()`. */
export interface NovantClientOptions {
  /** API key, i.e. "ak_xxx" (project key) or "ak_org_xxx" (org key). */
  apiKey: string;

  /**
   * Default project id for project requests. Org keys must specify a
   * project, either here or per call with `proj_id`.
   */
  projId?: number;

  /** Request timeout in milliseconds (default 30000). */
  timeout?: number;

  /** Base API URL (default "https://api.novant.io/v1"). */
  baseUrl?: string;

  /** Custom fetch implementation (defaults to global fetch). */
  fetch?: typeof fetch;
}

/** Common option for all project requests. */
export interface ProjOptions {
  /** Project id; required for org keys unless set on the client. */
  proj_id?: number;
}

export interface AssetsOptions extends ProjOptions {
  asset_ids?: string[];
}

export interface SpacesOptions extends ProjOptions {
  space_ids?: string[];
}

export interface ZonesOptions extends ProjOptions {
  zone_ids?: string[];
}

export interface SourcesOptions extends ProjOptions {
  source_ids?: string[];
  /** Only return bound sources. */
  bound_only?: boolean;
}

export interface SourceMapsOptions extends ProjOptions {
  source_map_ids?: string[];
}

export interface PointsOptions extends ProjOptions {
  /** One of source_id, asset_id, or space_id is required. */
  source_id?: string;
  asset_id?: string;
  space_id?: string;
  point_ids?: string[];
  point_types?: string[];
}

export interface ValuesOptions extends ProjOptions {
  /**
   * One of source_id, source_ids, asset_id, or space_id is required.
   * Precedence is source_id, source_ids, asset_id, then space_id.
   */
  source_id?: string;
  source_ids?: string[];
  asset_id?: string;
  space_id?: string;
  point_ids?: string[];
  point_types?: string[];
}

export interface TrendsOptions extends ProjOptions {
  point_ids: string[];
  /** Single date as YYYY-MM-DD; takes precedence over start/end. */
  date?: string;
  /** Start date as YYYY-MM-DD (required unless date is set). */
  start_date?: string;
  /** End date as YYYY-MM-DD, inclusive (required unless date is set). */
  end_date?: string;
  /** Timezone for results (defaults to the project timezone). */
  tz?: string;
  interval?: OpenString<"auto" | "5min" | "15min" | "30min" | "1hr" | "1day" | "1mo" | "raw">;
  aggregate?: OpenString<"auto" | "mean" | "sum" | "min" | "max" | "diff">;
}

export interface ScenesOptions extends ProjOptions {
  /** Fetch a single scene. */
  scene_id?: string;
}

export interface SchedulesOptions extends ProjOptions {
  /** Fetch a single schedule. */
  schedule_id?: string;
}

export interface WriteOptions extends ProjOptions {
  /** Priority level (defaults to 16). */
  level?: number;
  /** Auto-release duration, i.e. "1hr", "30min", "1day". */
  expires?: string;
}

export interface ExplorerScanOptions extends ProjOptions {
  /** Edge node serial number (defaults to the first node in the project). */
  node_id?: string;
  /**
   * Op specific parameters, i.e. port, range_low, range_high, ip_addrs,
   * ip_addr, credential, tls, uuids. Arrays are joined with commas and
   * booleans sent as true/false.
   */
  [param: string]: unknown;
}

export interface ExplorerLearnOptions extends ProjOptions {
  /** Edge node serial number (defaults to the node that discovered it). */
  node_id?: string;
}

export interface ImportTrendsOptions extends ProjOptions {
  mode?: OpenString<"merge" | "append" | "prepend">;
}

/** CSV request body. */
export type CsvData = string | Uint8Array;

type Params = Record<string, string>;

/////////////////////////////////////////////////////////////////////////
// NovantClient
/////////////////////////////////////////////////////////////////////////

/** Client for the Novant REST API. */
export class NovantClient {
  readonly projId?: number;
  readonly timeout: number;
  readonly baseUrl: string;

  #apiKey: string;
  #fetch: typeof fetch;

  /**
   * Create a new client.
   *
   * Project keys ("ak_xxx") are bound to a single project and do not
   * require a project id. Org keys ("ak_org_xxx") can access any project
   * in the organization, and must specify a project on every project
   * request, either here with `projId` or per call with `proj_id`.
   */
  constructor(opts: NovantClientOptions) {
    if (!opts?.apiKey) throw new Error("apiKey is required");
    this.#apiKey = opts.apiKey;
    this.projId = opts.projId;
    this.timeout = opts.timeout ?? 30_000;
    this.baseUrl = (opts.baseUrl ?? "https://api.novant.io/v1").replace(/\/+$/, "");
    this.#fetch = opts.fetch ?? globalThis.fetch;
    if (!this.#fetch) throw new Error("fetch not available; requires Node 18+ or pass opts.fetch");
  }

  //////////////////////////////////////////////////////////////////////
  // Org
  //////////////////////////////////////////////////////////////////////

  /**
   * List all projects in the organization. Requires an org key; project
   * keys fail with 403.
   */
  orgProjects(): Promise<OrgProjectList> {
    return this.#get("/org/projects", {});
  }

  //////////////////////////////////////////////////////////////////////
  // Typedef
  //////////////////////////////////////////////////////////////////////

  // Typedef endpoints are the global type registry, the same for every
  // project, so they are not project scoped and never send proj_id.
  // Types change rarely; fetch once and cache rather than per request.

  /** List zone types. Zones have no props, so `props` is always empty. */
  typedefZones(): Promise<TypedefList> {
    return this.#get("/typedef/zones", {});
  }

  /** List space types and props. */
  typedefSpaces(): Promise<TypedefList> {
    return this.#get("/typedef/spaces", {});
  }

  /** List asset types and props. */
  typedefAssets(): Promise<TypedefList> {
    return this.#get("/typedef/assets", {});
  }

  /** List point types and props. */
  typedefPoints(): Promise<TypedefList> {
    return this.#get("/typedef/points", {});
  }

  //////////////////////////////////////////////////////////////////////
  // Project
  //////////////////////////////////////////////////////////////////////

  /** Get project metadata. */
  project(opts: ProjOptions = {}): Promise<Project> {
    return this.#get("/project", this.#params(opts));
  }

  //////////////////////////////////////////////////////////////////////
  // Assets / Spaces / Zones
  //////////////////////////////////////////////////////////////////////

  /** List assets for this project. */
  assets(opts: AssetsOptions = {}): Promise<AssetList> {
    return this.#get("/assets", this.#params(opts));
  }

  /** List spaces for this project. */
  spaces(opts: SpacesOptions = {}): Promise<SpaceList> {
    return this.#get("/spaces", this.#params(opts));
  }

  /** List zones for this project. */
  zones(opts: ZonesOptions = {}): Promise<ZoneList> {
    return this.#get("/zones", this.#params(opts));
  }

  //////////////////////////////////////////////////////////////////////
  // Sources / Source Maps
  //////////////////////////////////////////////////////////////////////

  /** List sources for this project. */
  sources(opts: SourcesOptions = {}): Promise<SourceList> {
    const { bound_only, ...rest } = opts;
    const params = this.#params(rest);
    if (bound_only) params.bound_only = "true";
    return this.#get("/sources", params);
  }

  /** List source maps for this project. */
  sourceMaps(opts: SourceMapsOptions = {}): Promise<SourceMapList> {
    return this.#get("/source-maps", this.#params(opts));
  }

  //////////////////////////////////////////////////////////////////////
  // Points / Values / Trends
  //////////////////////////////////////////////////////////////////////

  /** List points for a source, asset, or space. */
  points(opts: PointsOptions): Promise<PointList> {
    return this.#get("/points", this.#params(opts));
  }

  /** Get current values for points. */
  values(opts: ValuesOptions): Promise<ValueList> {
    return this.#get("/values", this.#params(opts));
  }

  /** Get historical trend data for points. */
  trends(opts: TrendsOptions): Promise<TrendData> {
    const { date, start_date, end_date, ...rest } = opts;
    const params = this.#params(rest);
    if (date !== undefined) {
      params.date = date;
    } else {
      if (start_date !== undefined) params.start_date = start_date;
      if (end_date !== undefined) params.end_date = end_date;
    }
    return this.#get("/trends", params);
  }

  //////////////////////////////////////////////////////////////////////
  // Scenes / Schedules
  //////////////////////////////////////////////////////////////////////

  /** List scenes for this project. */
  scenes(opts: ScenesOptions = {}): Promise<SceneList> {
    return this.#get("/scenes", this.#params(opts));
  }

  /** List schedules for this project. */
  schedules(opts: SchedulesOptions = {}): Promise<ScheduleList> {
    return this.#get("/schedules", this.#params(opts));
  }

  //////////////////////////////////////////////////////////////////////
  // Write
  //////////////////////////////////////////////////////////////////////

  /**
   * Write a value to a point. Pass `null` to clear the priority hold.
   * Requires a Control API key.
   */
  write(point_id: string, value: number | null, opts: WriteOptions = {}): Promise<StatusResponse> {
    const params = this.#params(opts);
    params.point_id = point_id;
    params.value = value === null ? "null" : String(value);
    return this.#postForm("/write", params);
  }

  /**
   * Write values to multiple points in a single request. Validation is
   * all-or-nothing: if any entry is invalid the entire request is
   * rejected and no writes are committed. Requires a Control API key.
   */
  async writeBatch(writes: WriteEntry[], opts: ProjOptions = {}): Promise<StatusResponse> {
    if (!Array.isArray(writes) || writes.length === 0) {
      throw new Error("writes must be a non-empty array");
    }
    const params = this.#params(opts);
    writes.forEach((w, i) => {
      if (w.point_id === undefined) throw new Error(`writes[${i}] missing required 'point_id'`);
      if (w.value === undefined) throw new Error(`writes[${i}] missing required 'value'`);
      params[`writes[${i}][point_id]`] = w.point_id;
      params[`writes[${i}][value]`] = w.value === null ? "null" : String(w.value);
      if (w.level != null) params[`writes[${i}][level]`] = String(w.level);
      if (w.expires != null) params[`writes[${i}][expires]`] = String(w.expires);
    });
    return this.#postForm("/write", params);
  }

  //////////////////////////////////////////////////////////////////////
  // Explorer
  //////////////////////////////////////////////////////////////////////

  /**
   * Queue a discovery operation on an edge node, i.e. "bacnet-scan".
   * Scans run asynchronously: poll `explorerOps()` no faster than once
   * every 30 seconds until the op is done, then read results from
   * `explorerSources()`. Requires an Edit API key.
   */
  explorerScan(op: OpenString<"bacnet-scan" | "bacnet-find" | "jasper-scan" | "influx-scan" | "kaiterra-find">,
               opts: ExplorerScanOptions = {}): Promise<ExplorerOpResponse> {
    const params = this.#params(opts);
    params.op = op;
    return this.#postForm("/explorer/scan", params);
  }

  /**
   * Queue a learn operation to read a discovered source's point list.
   * Learns run asynchronously: poll `explorerOps()` no faster than once
   * every 30 seconds until the op is done, then read results from
   * `explorerPoints()`. Requires an Edit API key.
   */
  explorerLearn(source_id: string, opts: ExplorerLearnOptions = {}): Promise<ExplorerOpResponse> {
    const params = this.#params(opts);
    params.source_id = source_id;
    return this.#postForm("/explorer/learn", params);
  }

  /**
   * Get the status of explorer operations: queued, active, and those
   * completed in the last 24 hours. Do not poll faster than once every
   * 30 seconds.
   */
  explorerOps(opts: ProjOptions = {}): Promise<ExplorerOpList> {
    return this.#get("/explorer/ops", this.#params(opts));
  }

  /** List the sources discovered in this project. */
  explorerSources(opts: ProjOptions = {}): Promise<ExplorerSourceList> {
    return this.#get("/explorer/sources", this.#params(opts));
  }

  /** List the points advertised by a discovered source. */
  explorerPoints(source_id: string, opts: ProjOptions = {}): Promise<ExplorerPointList> {
    const params = this.#params(opts);
    params.source_id = source_id;
    return this.#get("/explorer/points", params);
  }

  //////////////////////////////////////////////////////////////////////
  // Import
  //////////////////////////////////////////////////////////////////////

  /** Import zones from CSV. Requires an Edit API key. */
  importZones(csv: CsvData, opts: ProjOptions = {}): Promise<StatusResponse> {
    return this.#postCsv("/import/zones", csv, this.#params(opts));
  }

  /** Import spaces from CSV. Requires an Edit API key. */
  importSpaces(csv: CsvData, opts: ProjOptions = {}): Promise<StatusResponse> {
    return this.#postCsv("/import/spaces", csv, this.#params(opts));
  }

  /** Import assets from CSV. Requires an Edit API key. */
  importAssets(csv: CsvData, opts: ProjOptions = {}): Promise<StatusResponse> {
    return this.#postCsv("/import/assets", csv, this.#params(opts));
  }

  /** Import sources from CSV. Requires an Edit API key. */
  importSources(csv: CsvData, opts: ProjOptions = {}): Promise<StatusResponse> {
    return this.#postCsv("/import/sources", csv, this.#params(opts));
  }

  /** Import a source map from CSV. Requires an Edit API key. */
  importSourceMap(csv: CsvData, opts: ProjOptions = {}): Promise<StatusResponse> {
    return this.#postCsv("/import/source-map", csv, this.#params(opts));
  }

  /**
   * Import a scene from CSV: the first data row is the scene, and each
   * following row is a point with one column per mode. Requires a
   * Control API key.
   */
  importScene(csv: CsvData, opts: ProjOptions = {}): Promise<StatusResponse> {
    return this.#postCsv("/import/scene", csv, this.#params(opts));
  }

  /**
   * Import schedules from CSV. Rows without an id add a schedule; rows
   * with one update it. Requires a Control API key.
   */
  importSchedules(csv: CsvData, opts: ProjOptions = {}): Promise<StatusResponse> {
    return this.#postCsv("/import/schedules", csv, this.#params(opts));
  }

  /**
   * Import trend data from CSV: `ts` as the first column (ISO 8601)
   * followed by point id columns. Requires an Edit API key.
   */
  importTrends(csv: CsvData, opts: ImportTrendsOptions = {}): Promise<StatusResponse> {
    return this.#postCsv("/import/trends", csv, this.#params(opts));
  }

  //////////////////////////////////////////////////////////////////////
  // Private
  //////////////////////////////////////////////////////////////////////

  /** Encode request options to string params, applying default proj_id. */
  #params(opts: object): Params {
    const params: Params = {};
    const projId = (opts as ProjOptions).proj_id ?? this.projId;
    if (projId !== undefined) params.proj_id = String(projId);
    for (const [k, v] of Object.entries(opts)) {
      if (k === "proj_id" || v === undefined || v === null) continue;
      params[k] = encodeParam(v);
    }
    return params;
  }

  #get<T>(path: string, params: Params): Promise<T> {
    return this.#send(this.#url(path, params), { method: "GET" });
  }

  #postForm<T>(path: string, params: Params): Promise<T> {
    return this.#send(this.#url(path), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
  }

  #postCsv<T>(path: string, csv: CsvData, params: Params): Promise<T> {
    return this.#send(this.#url(path, params), {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: csv,
    });
  }

  #url(path: string, params?: Params): string {
    const qs = params ? new URLSearchParams(params).toString() : "";
    return this.baseUrl + path + (qs ? "?" + qs : "");
  }

  async #send<T>(url: string, init: { method: string; headers?: Record<string, string>; body?: string | Uint8Array }): Promise<T> {
    const res = await this.#fetch(url, {
      method: init.method,
      headers: {
        "Authorization": "Basic " + btoa(this.#apiKey + ":"),
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "User-Agent": `novant-js/${VERSION}`,
        ...init.headers,
      },
      body: init.body as BodyInit | undefined,
      signal: AbortSignal.timeout(this.timeout),
    });

    const text = await res.text();
    if (!res.ok) {
      let body: unknown;
      try { body = JSON.parse(text); } catch { body = undefined; }
      throw new NovantError(res.status, body);
    }
    return JSON.parse(text) as T;
  }
}

/** Encode a param value: arrays join with commas, bools as true/false. */
function encodeParam(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join(",");
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}
