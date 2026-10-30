import { afterEach, describe, expect, it, vi } from "vitest";

import { loadConfig } from "./index.js";

class ConfigExit extends Error {
  constructor(readonly code: number) {
    super(`config exit ${code}`);
  }
}

const validEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  PORT: "4321",
  DATABASE_URL: "mysql://user:password@localhost:3306/app",
  SESSION_SECRET: "a".repeat(32),
  CORS_ORIGINS: "http://localhost:2173, https://example.com",
  TRUST_PROXY: "1",
  SERVE_CLIENT: "false",
  LOG_LEVEL: "debug",
  LOG_FORMAT: "json",
  SERVICE_NAME: "unah-red-tutores-api-test",
};

function runInvalid(env: NodeJS.ProcessEnv): {
  code: number;
  output: string;
} {
  let output = "";
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    output += String(chunk);
    return true;
  });
  vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new ConfigExit(code ?? 0);
  }) as never);

  try {
    loadConfig(env);
    throw new Error("loadConfig should have exited");
  } catch (error) {
    if (error instanceof ConfigExit) {
      return { code: error.code, output };
    }
    throw error;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadConfig", () => {
  it("parses and coerces a valid environment", () => {
    const config = loadConfig(validEnv);

    expect(config.port).toBe(4321);
    expect(config.databaseUrl).toBe(validEnv.DATABASE_URL);
    expect(config.corsOrigins).toEqual([
      "http://localhost:2173",
      "https://example.com",
    ]);
    expect(config.trustProxy).toBe(1);
    expect(config.serveClient).toBe(false);
    expect(config.logFormat).toBe("json");
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.corsOrigins)).toBe(true);
  });

  it("defaults LOG_FORMAT to json in production and pretty elsewhere", () => {
    expect(
      loadConfig({ ...validEnv, NODE_ENV: "production", LOG_FORMAT: undefined })
        .logFormat,
    ).toBe("json");
    expect(
      loadConfig({ ...validEnv, NODE_ENV: "development", LOG_FORMAT: undefined })
        .logFormat,
    ).toBe("pretty");
  });

  it("reports a missing SESSION_SECRET", () => {
    const { code, output } = runInvalid({
      ...validEnv,
      SESSION_SECRET: undefined,
    });

    expect(code).toBe(1);
    expect(output).toContain("SESSION_SECRET");
  });

  it("reports a short SESSION_SECRET without echoing its value", () => {
    const secret = "too-short-and-secret";
    const { code, output } = runInvalid({ ...validEnv, SESSION_SECRET: secret });

    expect(code).toBe(1);
    expect(output).toContain("SESSION_SECRET");
    expect(output).not.toContain(secret);
  });

  it("reports a DATABASE_URL with the wrong scheme", () => {
    const { code, output } = runInvalid({
      ...validEnv,
      DATABASE_URL: "postgres://user:password@localhost:5432/app",
    });

    expect(code).toBe(1);
    expect(output).toMatch(/DATABASE_URL: .*mysql:\/\/ or mariadb:\/\//);
  });

  it("reports a non-numeric PORT", () => {
    const { code, output } = runInvalid({ ...validEnv, PORT: "not-a-port" });

    expect(code).toBe(1);
    expect(output).toContain("PORT");
  });
});
