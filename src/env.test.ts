import { afterEach, describe, expect, it, vi } from "vitest";

describe("server environment", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("accepts a PostgreSQL connection URL", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5432/stockerp");
    const { getServerEnv } = await import("./env");

    expect(getServerEnv().DATABASE_URL).toContain("stockerp");
  });

  it("rejects a non-PostgreSQL URL", async () => {
    vi.stubEnv("DATABASE_URL", "https://example.com/database");
    const { getServerEnv } = await import("./env");

    expect(() => getServerEnv()).toThrow();
  });
});
