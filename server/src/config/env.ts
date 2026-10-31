import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { z } from "zod";

const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/**
 * Load environment variables from exactly one file.
 *
 * `ENV_FILE` wins when set; otherwise `server/.env` is loaded when it exists.
 * This is the only module in the server allowed to import `dotenv`.
 */
export function loadEnvFile(env: NodeJS.ProcessEnv = process.env): void {
  const configured = env.ENV_FILE;
  const envPath = configured
    ? path.resolve(process.cwd(), configured)
    : path.join(serverRoot, ".env");

  if (!configured && !existsSync(envPath)) {
    return;
  }

  dotenv.config({ path: envPath, quiet: true });
}

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

export const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off", ""].includes(normalized)) return false;
  }
  return value;
}, z.boolean());

const optionalBoolean = (defaultValue: boolean) =>
  booleanFromEnv.optional().transform((value) => value ?? defaultValue);

const integerFromEnv = (defaultValue: number, min: number, max?: number) => {
  let schema = z.coerce.number().int().min(min);
  if (max !== undefined) schema = schema.max(max);
  return z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    schema.default(defaultValue),
  );
};

const databaseUrl = z
  .string()
  .min(1, "is required")
  .refine(
    (value) => value.startsWith("mysql://") || value.startsWith("mariadb://"),
    "must start with mysql:// or mariadb://",
  );

const optionalDatabaseUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  databaseUrl.optional(),
);

const corsOrigins = z.preprocess(
  (value) =>
    typeof value === "string"
      ? value
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean)
      : value,
  z
    .array(z.url("must be a valid URL"))
    .optional()
    .transform((v) => v ?? []),
);

const commaSeparatedList = z.preprocess(
  (value) =>
    typeof value === "string"
      ? value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : value,
  z.array(z.string().min(1)).optional().transform((v) => v ?? []),
);

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url("must be a valid URL").optional(),
);

const privateKey = z.preprocess(
  (value) =>
    typeof value === "string" ? value.replace(/\\n/g, "\n") : value,
  z.string().min(1).optional(),
);

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: integerFromEnv(3000, 1, 65535),
  DATABASE_URL: databaseUrl,
  MIGRATE_DATABASE_URL: optionalDatabaseUrl,
  DB_POOL_LIMIT: integerFromEnv(10, 1),
  SESSION_SECRET: z.string().min(32, "must be at least 32 characters long"),
  CORS_ORIGINS: corsOrigins,
  TRUST_PROXY: integerFromEnv(0, 0),
  ORIGIN_SECRET: optionalString,
  SERVE_CLIENT: optionalBoolean(false),
  CLIENT_DIR: z.string().min(1).default("client-dist"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
  LOG_FORMAT: z.enum(["json", "pretty"]).optional(),
  SERVICE_NAME: z.string().min(1).default("unah-red-tutores-api"),
  OTEL_ENABLED: optionalBoolean(false),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.url("must be a valid URL").optional(),
  ),
  OTEL_SERVICE_NAME: optionalString,
  RATE_LIMIT_WINDOW_MS: integerFromEnv(900000, 1),
  RATE_LIMIT_MAX: integerFromEnv(300, 1),
  LOGIN_RATE_LIMIT_MAX: integerFromEnv(10, 1),
  BOOTSTRAP_ADMIN_EMAIL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.email("must be a valid email address").optional(),
  ),
  BOOTSTRAP_ADMIN_PASSWORD: optionalString,
  BOOTSTRAP_ADMIN_NAME: z.string().min(1).default("Administrator"),
  DOCS_DIR: z.string().min(1).default("docs/in-app"),
  COOKIE_DOMAIN: optionalString,
  SOFT_DELETE_HASH_KEY: optionalString,

  // Federated login. Each provider is only enabled when all of its variables
  // are present; see server/src/auth/providers.ts.
  MICROSOFT_CLIENT_ID: optionalString,
  MICROSOFT_CLIENT_SECRET: optionalString,
  MICROSOFT_ALLOWED_TENANT_IDS: commaSeparatedList,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  APPLE_CLIENT_ID: optionalString,
  APPLE_TEAM_ID: optionalString,
  APPLE_KEY_ID: optionalString,
  APPLE_PRIVATE_KEY: privateKey,
  APPLE_PRIVATE_KEY_PATH: optionalString,
  AUTH_CALLBACK_BASE_URL: optionalUrl,
  AUTH_SUCCESS_REDIRECT: z.string().min(1).default("/"),
  AUTH_FAILURE_REDIRECT: z.string().min(1).default("/auth/login"),
});

export const appConfigSchema = envSchema.transform((env) => ({
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  migrateDatabaseUrl: env.MIGRATE_DATABASE_URL,
  dbPoolLimit: env.DB_POOL_LIMIT,
  sessionSecret: env.SESSION_SECRET,
  corsOrigins: Object.freeze([...env.CORS_ORIGINS]),
  trustProxy: env.TRUST_PROXY,
  originSecret: env.ORIGIN_SECRET,
  serveClient: env.SERVE_CLIENT,
  clientDir: env.CLIENT_DIR,
  logLevel: env.LOG_LEVEL,
  logFormat:
    env.LOG_FORMAT ?? (env.NODE_ENV === "production" ? "json" : "pretty"),
  serviceName: env.SERVICE_NAME,
  otelEnabled: env.OTEL_ENABLED,
  otelExporterOtlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  otelServiceName: env.OTEL_SERVICE_NAME ?? env.SERVICE_NAME,
  rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: env.RATE_LIMIT_MAX,
  loginRateLimitMax: env.LOGIN_RATE_LIMIT_MAX,
  bootstrapAdminEmail: env.BOOTSTRAP_ADMIN_EMAIL,
  bootstrapAdminPassword: env.BOOTSTRAP_ADMIN_PASSWORD,
  bootstrapAdminName: env.BOOTSTRAP_ADMIN_NAME,
  docsDir: env.DOCS_DIR,
  cookieDomain: env.COOKIE_DOMAIN,
  softDeleteHashKey: env.SOFT_DELETE_HASH_KEY ?? env.SESSION_SECRET,
  microsoftClientId: env.MICROSOFT_CLIENT_ID,
  microsoftClientSecret: env.MICROSOFT_CLIENT_SECRET,
  microsoftAllowedTenantIds: Object.freeze(
    env.MICROSOFT_ALLOWED_TENANT_IDS.map((tenant) => tenant.toLowerCase()),
  ),
  googleClientId: env.GOOGLE_CLIENT_ID,
  googleClientSecret: env.GOOGLE_CLIENT_SECRET,
  appleClientId: env.APPLE_CLIENT_ID,
  appleTeamId: env.APPLE_TEAM_ID,
  appleKeyId: env.APPLE_KEY_ID,
  applePrivateKey: env.APPLE_PRIVATE_KEY,
  applePrivateKeyPath: env.APPLE_PRIVATE_KEY_PATH,
  authCallbackBaseUrl: env.AUTH_CALLBACK_BASE_URL?.replace(/\/+$/, ""),
  authSuccessRedirect: env.AUTH_SUCCESS_REDIRECT,
  authFailureRedirect: env.AUTH_FAILURE_REDIRECT,
}));

export const seedEnvSchema = envSchema
  .pick({
    NODE_ENV: true,
    DATABASE_URL: true,
    MIGRATE_DATABASE_URL: true,
    DB_POOL_LIMIT: true,
    BOOTSTRAP_ADMIN_EMAIL: true,
    BOOTSTRAP_ADMIN_PASSWORD: true,
    BOOTSTRAP_ADMIN_NAME: true,
    LOG_LEVEL: true,
    LOG_FORMAT: true,
  })
  .transform((env) => ({
    nodeEnv: env.NODE_ENV,
    databaseUrl: env.DATABASE_URL,
    migrateDatabaseUrl: env.MIGRATE_DATABASE_URL,
    dbPoolLimit: env.DB_POOL_LIMIT,
    bootstrapAdminEmail: env.BOOTSTRAP_ADMIN_EMAIL,
    bootstrapAdminPassword: env.BOOTSTRAP_ADMIN_PASSWORD,
    bootstrapAdminName: env.BOOTSTRAP_ADMIN_NAME,
    logLevel: env.LOG_LEVEL,
    logFormat: env.LOG_FORMAT,
  }));

export type AppConfig = z.infer<typeof appConfigSchema>;
export type SeedAppConfig = z.infer<typeof seedEnvSchema>;
export type Env = z.infer<typeof envSchema>;
