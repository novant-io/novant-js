//
// Copyright (c) 2026, Novant LLC
// Licensed under the MIT License
//
// Integration tests run against the live API using keys from env vars
// or files under secret/. Tests are skipped when keys are not available.
//

import { existsSync, readFileSync } from "node:fs";
import { NovantClient } from "../../src/index.js";

function readKey(env: string, file: string): string | undefined {
  if (process.env[env]) return process.env[env]!.trim();
  const path = new URL(`../../secret/${file}`, import.meta.url);
  return existsSync(path) ? readFileSync(path, "utf8").trim() : undefined;
}

/** Project API key for the test project (NOVANT_TEST_KEY or secret/test.key). */
export const testKey = readKey("NOVANT_TEST_KEY", "test.key");

/** Org API key containing the test project (NOVANT_TEST_ORG_KEY or secret/test.org_key). */
export const testOrgKey = readKey("NOVANT_TEST_ORG_KEY", "test.org_key");

export const client = testKey ? new NovantClient({ apiKey: testKey }) : undefined!;
export const orgClient = testOrgKey ? new NovantClient({ apiKey: testOrgKey }) : undefined!;

/** Pick any source id, preferring bound sources. */
export async function anySourceId(): Promise<string | undefined> {
  let res = await client.sources({ bound_only: true });
  if (res.sources.length === 0) res = await client.sources();
  return res.sources[0]?.id;
}
