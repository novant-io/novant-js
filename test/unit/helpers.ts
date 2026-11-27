//
// Copyright (c) 2026, Novant LLC
// Licensed under the MIT License
//

import { NovantClient, type NovantClientOptions } from "../../src/index.js";

export interface Call {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

/**
 * Create a client with a stubbed fetch that records each request and
 * responds with the given status and body.
 */
export function stubClient(
  resp: unknown = { proj_id: 1 },
  status = 200,
  opts: Partial<NovantClientOptions> = {},
) {
  const calls: Call[] = [];
  const fetch = (async (input: string, init: RequestInit) => {
    const body = init.body;
    calls.push({
      url: new URL(input),
      method: init.method ?? "GET",
      headers: init.headers as Record<string, string>,
      body: body instanceof Uint8Array ? new TextDecoder().decode(body) : (body as string | undefined),
    });
    const text = typeof resp === "string" ? resp : JSON.stringify(resp);
    return new Response(text, { status });
  }) as unknown as typeof globalThis.fetch;
  const client = new NovantClient({ apiKey: "ak_test", fetch, ...opts });
  const last = () => calls[calls.length - 1];
  const query = () => Object.fromEntries(last().url.searchParams);
  const form = () => Object.fromEntries(new URLSearchParams(last().body));
  return { client, calls, last, query, form };
}
