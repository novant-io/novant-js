//
// Copyright (c) 2026, Novant LLC
// Licensed under the MIT License
//

// Injected from package.json at build time (see tsup.config.ts and
// vitest.config.ts), so package.json is the single source of truth.
declare const __NOVANT_VERSION__: string;

/** SDK version. */
export const VERSION: string = __NOVANT_VERSION__;
