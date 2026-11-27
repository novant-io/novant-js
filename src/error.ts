//
// Copyright (c) 2026, Novant LLC
// Licensed under the MIT License
//

/////////////////////////////////////////////////////////////////////////
// NovantError
/////////////////////////////////////////////////////////////////////////

/** Error returned from the Novant API. */
export class NovantError extends Error {
  /** HTTP status code, i.e. 400, 403, 429. */
  readonly status: number;

  /** Parsed JSON error body if available, i.e. { msg: "..." }. */
  readonly body: unknown;

  constructor(status: number, body?: unknown) {
    super(NovantError.toMessage(status, body));
    this.name = "NovantError";
    this.status = status;
    this.body = body;
  }

  private static toMessage(status: number, body: unknown): string {
    if (body && typeof body === "object") {
      const b = body as Record<string, unknown>;
      const msg = b.msg ?? b.message ?? b.error;
      if (typeof msg === "string" && msg.length > 0) return msg;
      return JSON.stringify(body);
    }
    return `HTTP ${status}`;
  }
}
