# novant-js

Server-side JavaScript/TypeScript library for the [Novant](https://novant.io) API.

Full documentation at [docs.novant.io/sdk/js](https://docs.novant.io/sdk/js).

> **Server-side only.** Novant API keys are secrets. Use this library from
> Node.js, Bun, Deno, or serverless functions — never ship an API key to
> a browser.

## Installation

```bash
npm install novant
```

Requires Node.js 18 or later. Ships ESM and CommonJS builds with
TypeScript types included. No runtime dependencies.

## Quick Start

```js
import { NovantClient } from "novant";

const client = new NovantClient({ apiKey: "ak_xxx" });

// Get project info
const proj = await client.project();
console.log(proj.city);         // "Richmond, VA"
console.log(proj.tz);           // "New_York"

// List assets
const { assets } = await client.assets();
for (const asset of assets) {
  console.log(asset.name, asset.type);
}

// Read current values
const { values } = await client.values({ source_id: "s.2" });
for (const v of values) {
  console.log(v.id, v.val, v.status);
}

// Get trend data
const { trends } = await client.trends({
  point_ids: ["s.2.4", "s.2.5"],
  date: "2026-03-09",
});
for (const row of trends) {
  console.log(row.ts, row["s.2.4"], row["s.2.5"]);
}
```

CommonJS works too:

```js
const { NovantClient } = require("novant");
```

## Conventions

Responses are returned as plain JSON objects, exactly as documented in the
[API reference](https://docs.novant.io/api). Request options and response
fields use the same `snake_case` names as the API, so the API docs apply
directly:

```js
const res = await client.points({ space_id: "sp.1", point_types: ["zone_temp"] });
res.proj_id;            // 4821
res.points[0].enum_states;
```

Lists are passed as arrays and sent as comma separated values. To find an
item by id, use standard array methods:

```js
const ahu = assets.find((a) => a.id === "a.1");
```

## Organization Keys

Project keys (`ak_xxx`) are bound to a single project. Organization keys
(`ak_org_xxx`) can access any project in the organization, and must specify
which project to act on with `proj_id`:

```js
const client = new NovantClient({ apiKey: "ak_org_xxx" });

// List all projects in the organization
const { projects } = await client.orgProjects();
for (const p of projects) {
  console.log(p.proj_id, p.proj_name);
}

// Pass proj_id per call
const zones = await client.zones({ proj_id: 4821 });

// Or set a default project for all calls
const proj = new NovantClient({ apiKey: "ak_org_xxx", projId: 4821 });
await proj.zones();
```

All responses from project endpoints include the `proj_id` they were
served from.

## Writes

Writing to points requires a Control API key:

```js
await client.write("s.1.3", 72.0, { level: 8, expires: "1hr" });
await client.write("s.1.3", null);    // clear the priority hold

await client.writeBatch([
  { point_id: "s.1.3", value: 72.0 },
  { point_id: "s.1.4", value: 1, expires: "30min" },
]);
```

## Schedules

`scheduleActive` evaluates whether a schedule is active (occupied) at a
given time. Pass the project timezone to evaluate in project local time:

```js
import { scheduleActive } from "novant";

const { tz } = await client.project();
const { schedules } = await client.schedules();
for (const s of schedules) {
  console.log(s.name, scheduleActive(s, { tz }));
}
```

## Errors

API errors throw a `NovantError` with the HTTP `status` and the API's
error message:

```js
import { NovantError } from "novant";

try {
  await client.write("s.1.3", 72.0);
} catch (err) {
  if (err instanceof NovantError) {
    console.log(err.status, err.message);   // 403 "API key does not have required permissions."
  }
}
```

## Options

```js
new NovantClient({
  apiKey: "ak_xxx",     // required
  projId: 4821,         // default proj_id for org keys
  timeout: 30000,       // request timeout in ms (default 30000)
});
```

## Development

```bash
git clone https://github.com/novant-io/novant-js.git
cd novant-js
npm install
npm run build       # build dist/ (ESM + CJS + types)
npm run typecheck
```

## Testing

```bash
npm run test:unit
```

Integration tests run read-only against the live Novant API. Place a test
project's API key at `secret/test.key` (or set `NOVANT_TEST_KEY`), then:

```bash
npm test
```

Organization key tests additionally require an org key at
`secret/test.org_key` (or `NOVANT_TEST_ORG_KEY`), for an organization that
contains the test project. Tests are skipped if the keys are missing.
