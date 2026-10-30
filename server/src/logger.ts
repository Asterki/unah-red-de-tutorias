import { readFileSync } from "node:fs";

import pino, { type DestinationStream, type Logger } from "pino";

import type { AppConfig } from "./config/index.js";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version?: string };

export const REDACT_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  'res.headers["set-cookie"]',
  "password",
  "newPassword",
  "currentPassword",
  "token",
  "secret",
  "DATABASE_URL",
  "*.password",
  "*.newPassword",
  "*.currentPassword",
  "*.token",
  "*.secret",
  "*.DATABASE_URL",
] as const;

export type LoggerConfig = Pick<
  AppConfig,
  "serviceName" | "nodeEnv" | "logLevel" | "logFormat"
>;

/**
 * Build the root pino logger.
 *
 * A destination can be supplied by tests; production always writes to stdout.
 */
export function createLogger(
  config: LoggerConfig,
  destination?: DestinationStream,
): Logger {
  const usePretty = config.logFormat === "pretty";

  return pino(
    {
      level: config.logLevel,
      base: {
        service: config.serviceName,
        env: config.nodeEnv,
        version: packageJson.version ?? "0.0.0",
      },
      redact: {
        paths: [...REDACT_PATHS],
        censor: "[redacted]",
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      ...(usePretty
        ? {
            transport: {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "SYS:standard",
                ignore: "pid,hostname",
              },
            },
          }
        : {}),
    },
    destination,
  );
}

let rootLogger: Logger = pino({
  level: "info",
  base: { service: "unah-red-tutores-api" },
  redact: { paths: [...REDACT_PATHS], censor: "[redacted]" },
});

export function setRootLogger(logger: Logger): void {
  rootLogger = logger;
}

export function getRootLogger(): Logger {
  return rootLogger;
}

/**
 * Stable logger handle for modules that do not receive `req.log`.
 *
 * It forwards to whichever root logger `main()` installed, so importing a
 * service never creates a second logger configuration.
 */
export const logger = new Proxy({} as Logger, {
  get(_target, property) {
    const value = Reflect.get(rootLogger, property) as unknown;
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(rootLogger);
    }
    return value;
  },
});

/**
 * Last-resort process handlers. Called from `main()` after the logger exists.
 */
export function installProcessHandlers(root: Logger = logger): void {
  const fatal = (message: string, error: unknown): never => {
    root.fatal({ err: error }, message);
    root.flush();
    process.exit(1);
  };

  process.on("unhandledRejection", (reason) => {
    fatal("Unhandled promise rejection", reason);
  });
  process.on("uncaughtException", (error) => {
    fatal("Uncaught exception", error);
  });
}
