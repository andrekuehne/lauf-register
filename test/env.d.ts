declare namespace Cloudflare {
  interface Env {
    /** Test-only binding: migrations read in vitest.config.ts, applied in test/apply-migrations.ts. */
    TEST_MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
