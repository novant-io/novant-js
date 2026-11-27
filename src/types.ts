//
// Copyright (c) 2026, Novant LLC
// Licensed under the MIT License
//
// Response types for the Novant API. Responses are returned as plain
// JSON objects exactly as sent by the API; these types describe them.
// Optional fields are omitted by the API when they have no value.
//

/////////////////////////////////////////////////////////////////////////
// Common
/////////////////////////////////////////////////////////////////////////

/** API key access level for a project. */
export type Access = "read" | "edit" | "control";

/** Point value: a number, "na" if not a number, or null if unknown. */
export type PointVal = number | "na" | null;

/** Ontology classification for an entity. */
export interface Ontology {
  brick?: string;
  haystack?: string;
  vbis?: string;
  rec?: string;
}

/** Response from POST endpoints that perform an action. */
export interface StatusResponse {
  proj_id: number;
  status: string;
}

/////////////////////////////////////////////////////////////////////////
// Org
/////////////////////////////////////////////////////////////////////////

/** Project summary from the org projects endpoint. */
export interface OrgProject {
  proj_id: number;
  proj_name: string;
  city: string;
  tz: string;
  area?: number;
  access: Access;
}

/** Response from `/v1/org/projects`. */
export interface OrgProjectList {
  projects: OrgProject[];
}

/////////////////////////////////////////////////////////////////////////
// Project
/////////////////////////////////////////////////////////////////////////

/** Response from `/v1/project`. */
export interface Project {
  proj_id: number;
  proj_name: string;
  area: number;
  city: string;
  /** Novant timezone name, i.e. "New_York". */
  tz: string;
  usage: number;
  capacity: number;
  max_trend_years: number;
  access: Access;
}

/////////////////////////////////////////////////////////////////////////
// Assets / Spaces / Zones
/////////////////////////////////////////////////////////////////////////

/** A project asset. */
export interface Asset {
  id: string;
  name: string;
  type: string;
  parent_space_id?: string;
  parent_zone_ids?: string[];
  fed_by_asset_ids?: string[];
  props?: Record<string, unknown>;
  ontology?: Ontology;
  source_ids?: string[];
}

/** Response from `/v1/assets`. */
export interface AssetList {
  proj_id: number;
  currency: string;
  assets: Asset[];
}

/** A building space. */
export interface Space {
  id: string;
  name: string;
  type: string;
  parent_space_id?: string;
  parent_zone_ids?: string[];
  contains_asset_ids?: string[];
  fed_by_asset_ids?: string[];
  props?: Record<string, unknown>;
  ontology?: Ontology;
}

/** Response from `/v1/spaces`. */
export interface SpaceList {
  proj_id: number;
  spaces: Space[];
}

/** An operational zone (HVAC, lighting, etc). */
export interface Zone {
  id: string;
  name: string;
  type: string;
  parent_zone_id?: string;
  fed_by_asset_ids?: string[];
  feeds_space_ids?: string[];
  ontology?: Ontology;
}

/** Response from `/v1/zones`. */
export interface ZoneList {
  proj_id: number;
  zones: Zone[];
}

/////////////////////////////////////////////////////////////////////////
// Sources / Source Maps
/////////////////////////////////////////////////////////////////////////

/** A data source (device or service). */
export interface Source {
  id: string;
  name: string;
  type: string;
  addr: string;
  device_id?: number;
  vendor?: string;
  model?: string;
  version?: string;
  firmware?: string;
  desc?: string;
  enabled: boolean;
  bound: boolean;
  /** Omitted for unbound sources. */
  source_map_id?: string;
  /** Edge node serial number; omitted for unbound sources. */
  node_id?: string;
  parent_asset_id?: string;
  /** Target poll frequency in seconds. */
  target_poll_freq?: number;
  /** Trend interval in seconds. */
  trend_interval?: number;
}

/** Response from `/v1/sources`. */
export interface SourceList {
  proj_id: number;
  sources: Source[];
}

/** A point within a source map. */
export interface SourceMapPoint {
  /** Local point id within the map, i.e. 2 (s.7.2 on bound source s.7). */
  id: number;
  name: string;
  type: string;
  addr: string;
  kind: PointKind;
  unit?: string;
  enum?: string;
  desc?: string;
  schedule?: string;
  mode?: string;
  limit?: string;
  modifier?: string;
  writable: boolean;
}

/** A template of points shared by every source bound to it. */
export interface SourceMap {
  id: string;
  name: string;
  type: string;
  vendor?: string;
  model?: string;
  desc?: string;
  num_bound: number;
  points: SourceMapPoint[];
}

/** Response from `/v1/source-maps`. */
export interface SourceMapList {
  proj_id: number;
  source_maps: SourceMap[];
}

/////////////////////////////////////////////////////////////////////////
// Points
/////////////////////////////////////////////////////////////////////////

/** Point value kind. */
export type PointKind = "num" | "bool" | "enum";

/** Enumeration state for a point. */
export interface EnumState {
  val: number;
  name: string;
}

/** A sensor or control point. */
export interface Point {
  id: string;
  name: string;
  type: string;
  addr: string;
  kind: PointKind;
  unit?: string;
  enum?: string;
  enum_states?: EnumState[];
  desc?: string;
  schedule?: string;
  mode?: string;
  limit?: string;
  modifier?: string;
  writable: boolean;
  ontology?: Ontology;
}

/**
 * Response from `/v1/points`. The parent fields populated depend on
 * which parent was used in the request: source_id, asset_id, or space_id.
 */
export interface PointList {
  proj_id: number;
  source_id?: string;
  source_name?: string;
  source_bound?: boolean;
  source_enabled?: boolean;
  asset_id?: string;
  asset_name?: string;
  space_id?: string;
  space_name?: string;
  source_ids?: string[];
  points: Point[];
}

/////////////////////////////////////////////////////////////////////////
// Values
/////////////////////////////////////////////////////////////////////////

/** An active priority level on a writable point. */
export interface PointLevel {
  /** Priority level 1-16. */
  level: number;
  val: PointVal;
  /** "external", a user id (u.5), schedule (sch.1), scene (sn.1), or "api". */
  who: string;
  /** ISO 8601 timestamp this level auto-releases. */
  expires?: string;
}

/** A current point value. */
export interface PointValue {
  id: string;
  val: PointVal;
  status: "ok" | "fault" | "unknown";
  /** Set when status is "fault". */
  err_code?: string;
  effective_level?: number;
  levels?: PointLevel[];
}

/**
 * Response from `/v1/values`. The parent fields populated depend on
 * which parent was used in the request.
 */
export interface ValueList {
  proj_id: number;
  source_id?: string;
  asset_id?: string;
  space_id?: string;
  source_ids?: string[];
  values: PointValue[];
}

/////////////////////////////////////////////////////////////////////////
// Trends
/////////////////////////////////////////////////////////////////////////

/**
 * A trend row: `ts` (ISO 8601 timestamp) plus one key per point id,
 * i.e. `{ ts: "2026-03-09T00:00:00-05:00", "s.2.4": 72.1 }`.
 */
export type TrendRow = { ts: string } & { [pointId: string]: PointVal };

/** Response from `/v1/trends`. */
export interface TrendData {
  proj_id: number;
  start: string;
  end: string;
  tz: string;
  interval: string;
  aggregate: string;
  point_ids: string[];
  trends: TrendRow[];
}

/////////////////////////////////////////////////////////////////////////
// Scenes / Schedules
/////////////////////////////////////////////////////////////////////////

/** A named mode within a scene, mapping point ids to target values. */
export interface SceneMode {
  /** Full mode id, i.e. "sn.5.1". */
  id: string;
  name: string;
  vals: Record<string, PointVal>;
}

/** A scene: a set of point target values across one or more modes. */
export interface Scene {
  id: string;
  name: string;
  point_ids: string[];
  modes: SceneMode[];
}

/** Response from `/v1/scenes`. */
export interface SceneList {
  proj_id: number;
  scenes: Scene[];
}

/** A schedule: occupancy rules plus the scene modes applied by it. */
export interface Schedule {
  id: string;
  name: string;
  /** Schedule rule string, i.e. "weekdays 8:00-17:00, sat 9:00-12:00". */
  schedule: string;
  active_mode_ids: string[];
  inactive_mode_ids: string[];
}

/** Response from `/v1/schedules`. */
export interface ScheduleList {
  proj_id: number;
  schedules: Schedule[];
}

/////////////////////////////////////////////////////////////////////////
// Write
/////////////////////////////////////////////////////////////////////////

/** A single write entry for `writeBatch`. */
export interface WriteEntry {
  point_id: string;
  /** Value to write, or null to clear the priority hold. */
  value: number | null;
  /** Priority level (defaults to 16). */
  level?: number;
  /** Auto-release duration, i.e. "1hr", "30min", "1day". */
  expires?: string;
}

/////////////////////////////////////////////////////////////////////////
// Explorer
/////////////////////////////////////////////////////////////////////////

/** Response from `/v1/explorer/scan` and `/v1/explorer/learn`. */
export interface ExplorerOpResponse extends StatusResponse {
  op_id: string;
}

/** An explorer scan or learn operation. */
export interface ExplorerOp {
  id: string;
  op: string;
  /** "queued" -> "active" -> "ok" | "error" */
  state: "queued" | "active" | "ok" | "error";
  node_id?: string | null;
  /** Learn operations only. */
  source_id?: string;
  started?: string;
  finished?: string;
  summary?: string;
  /** Set only when state is "error". */
  err_code?: string;
}

/** Response from `/v1/explorer/ops`. */
export interface ExplorerOpList {
  proj_id: number;
  ops: ExplorerOp[];
}

/** A source discovered by an explorer scan. */
export interface ExplorerSource {
  /** Discovery id, i.e. "c1578fe370e4" (distinct from "s.N" ids). */
  id: string;
  name: string;
  type: string;
  addr: string;
  device_id?: number | null;
  path?: string | null;
  vendor?: string | null;
  model?: string | null;
  version?: string | null;
  firmware?: string | null;
  desc?: string | null;
  last_scan?: string | null;
  last_learn?: string | null;
  point_count?: number | null;
}

/** Response from `/v1/explorer/sources`. */
export interface ExplorerSourceList {
  proj_id: number;
  sources: ExplorerSource[];
}

/** A point advertised by a discovered source. */
export interface ExplorerPoint {
  name: string;
  /** Protocol address, i.e. "ai.1". */
  addr: string;
  type: string;
  unit?: string | null;
  enum?: string | null;
  desc?: string | null;
  sample?: unknown;
}

/** Response from `/v1/explorer/points`. */
export interface ExplorerPointList {
  proj_id: number;
  source: ExplorerSource;
  points: ExplorerPoint[];
}
