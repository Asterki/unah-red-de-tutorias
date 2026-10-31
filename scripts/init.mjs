#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const markerPath = join(root, ".template-initialized");

const SLUG_PATTERN = /^[a-z][a-z0-9-]{1,40}$/;
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const LOCALES = new Set(["en", "es"]);

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  "site",
  ".vite",
  ".vercel",
  "tmp",
]);
const SKIP_FILES = new Set([
  "PLAN.md",
  "FINAL_PLAN.md",
  "SUMMARY.md",
  ".template-initialized",
  "scripts/init.mjs",
  "scripts/init.test.mjs",
  "LICENSE",
]);

const VALUE_FLAGS = new Set([
  "name",
  "slug",
  "title",
  "image",
  "owner",
  "repo",
  "locale",
  "brand",
]);
const BOOLEAN_FLAGS = new Set([
  "yes",
  "dry-run",
  "force",
  "no-db",
  "no-install",
]);

function fail(message) {
  process.stderr.write(`[init] ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) fail(`unexpected argument: ${item}`);

    const equals = item.indexOf("=");
    const name = item.slice(2, equals === -1 ? undefined : equals);
    if (VALUE_FLAGS.has(name)) {
      const value = equals === -1 ? argv[++index] : item.slice(equals + 1);
      if (value === undefined || value === "") fail(`--${name} requires a value`);
      options[name] = value;
    } else if (BOOLEAN_FLAGS.has(name)) {
      if (equals !== -1) fail(`--${name} does not take a value`);
      options[name] = true;
    } else {
      fail(`unknown flag: --${name}`);
    }
  }
  return options;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function currentDefaults() {
  if (existsSync(markerPath)) {
    try {
      return readJson(markerPath);
    } catch {
      fail(".template-initialized is not valid JSON; fix or remove it");
    }
  }

  const appConfig = readFileSync(join(root, "shared/src/config/app.ts"), "utf8");
  const appName = /APP_NAME = "([^"]+)"/.exec(appConfig)?.[1] ?? "Template App";
  const appSlug = /APP_SLUG = "([^"]+)"/.exec(appConfig)?.[1] ?? "template-app";
  const brand = /BRAND_COLOR = "([^"]+)"/.exec(appConfig)?.[1] ?? "#1677ff";

  return { name: appName, slug: appSlug, brand, locale: "en" };
}

function remoteDefaults() {
  const result = spawnSync("git", ["remote", "get-url", "origin"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) return { owner: "", repo: "" };

  const raw = result.stdout.trim();
  let owner = "";
  let repo = "";

  const https = /^https?:\/\/(?:[^@/]+@)?[^/]+\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(
    raw,
  );
  const ssh = /^git@[^:]+:([^/]+)\/([^/]+?)(?:\.git)?$/.exec(raw);
  const sshUrl = /^ssh:\/\/[^/]+\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(raw);
  const match = https ?? ssh ?? sshUrl;

  if (match) {
    owner = match[1];
    repo = raw
      .replace(/^git@([^:]+):/, "https://$1/")
      .replace(/^ssh:\/\//, "https://")
      .replace(/^https?:\/\/[^@/]+@/, "https://")
      .replace(/\.git$/, "")
      .replace(/\/$/, "");
  } else {
    repo = raw;
  }

  return { owner, repo };
}

function inferOwner(repo) {
  const match = /^https?:\/\/[^/]+\/([^/]+)\//.exec(repo ?? "");
  return match?.[1] ?? "";
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 41);
}

async function promptFor(defaults) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ask = async (label, value) => {
      const answer = (await rl.question(`${label} [${value}]: `)).trim();
      return answer || value;
    };

    return {
      name: await ask("Project name", defaults.name),
      slug: await ask("Project slug", defaults.slug),
      title: await ask("Application title", defaults.title),
      image: await ask("Image name", defaults.image),
      owner: await ask("GitHub owner", defaults.owner),
      repo: await ask("Repository URL", defaults.repo),
      locale: await ask("Default locale (en|es)", defaults.locale),
      brand: await ask("Brand colour (#rrggbb)", defaults.brand),
    };
  } finally {
    rl.close();
  }
}

async function resolveOptions(options) {
  const current = currentDefaults();
  const remote = remoteDefaults();

  const defaults = {
    name: current.name ?? "Template App",
    slug: current.slug ?? slugify(current.name ?? "template-app"),
    title:
      options.title ??
      (options.name ? String(options.name) : (current.title ?? current.name ?? "Template App")),
    image: current.image ?? `${current.slug ?? "template"}-api`,
    owner: current.owner ?? remote.owner,
    repo: current.repo ?? remote.repo,
    locale: current.locale ?? "en",
    brand: current.brand ?? "#1677ff",
  };

  const input =
    options.yes || !process.stdin.isTTY
      ? defaults
      : await promptFor(defaults);

  const name = String(options.name ?? input.name).trim();
  const slug = String(options.slug ?? input.slug).trim();
  const title = String(options.title ?? input.title).trim();
  const owner = String(options.owner ?? input.owner ?? "").trim();
  let repo = String(options.repo ?? input.repo ?? "").trim();
  if (repo && !owner) repo = repo;
  const locale = String(options.locale ?? input.locale).trim().toLowerCase();
  const brand = String(options.brand ?? input.brand).trim();
  const defaultImage = options.slug
    ? (current.image ?? `${slug}-api`)
    : (input.image ?? `${slug}-api`);
  const image = String(options.image ?? defaultImage).trim();

  if (!name) fail("--name must not be empty");
  if (!SLUG_PATTERN.test(slug)) {
    fail("--slug must match ^[a-z][a-z0-9-]{1,40}$");
  }
  if (!HEX_COLOR.test(brand)) fail("--brand must be a hex colour");
  if (!LOCALES.has(locale)) fail("--locale must be en or es");
  if (!image || /\s/.test(image)) fail("--image must not contain spaces");

  const resolvedOwner = owner || inferOwner(repo);
  if (!title) fail("--title must not be empty");

  return {
    name,
    slug,
    title,
    image,
    owner: resolvedOwner,
    repo,
    locale,
    brand: brand.toLowerCase(),
  };
}

function textFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      textFiles(join(directory, entry.name), files);
      continue;
    }
    if (!entry.isFile()) continue;

    const full = join(directory, entry.name);
    const rel = relative(root, full).split("\\").join("/");
    if (rel.startsWith("docs/archive/")) continue;
    if (SKIP_FILES.has(rel)) continue;
    if (/(^|\/)\.env($|\.)/.test(rel) && !rel.endsWith(".example")) continue;

    const extension = extname(entry.name);
    const known = [
      ".ts",
      ".tsx",
      ".js",
      ".mjs",
      ".cjs",
      ".json",
      ".md",
      ".yml",
      ".yaml",
      ".html",
      ".css",
      ".txt",
      ".toml",
      ".sh",
      ".example",
    ].includes(extension);
    const special = [
      "Dockerfile",
      ".nvmrc",
      ".gitignore",
      ".gitattributes",
      ".editorconfig",
      "CODEOWNERS",
      "requirements.txt",
    ].includes(entry.name);

    if (known || special) files.push(full);
  }
  return files;
}

function buildReplacements(options) {
  const { name, slug, image, owner, repo } = options;
  const replacements = [
    ["https://github.com/Asterki/unah-red-de-tutorias", repo || "https://github.com/OWNER/REPOSITORY"],
    ["@template/", `@${slug}/`],
    ["template-dev", `${slug}-dev`],
    ["template-prod", `${slug}-prod`],
    ["template-ghcr", `${slug}-ghcr`],
    ["mariadb-data", `${slug}-mariadb-data`],
    ["random-system", slug],
    ["template-app", slug],
    ["template-api", image],
    ["Template App", name],
    ["Fernando Rivera", owner || name],
    ["https://asterki.xyz", repo || "https://github.com/OWNER/REPOSITORY"],
    ["https://github.com/Asterki", owner ? `https://github.com/${owner}` : "https://github.com/OWNER"],
    ["@OWNER", owner ? `@${owner}` : "@OWNER"],
    ["site_name: Template Documentation", `site_name: ${options.title}`],
  ];

  return replacements.filter(([from, to]) => from !== to);
}

function planAndApply(options, dryRun) {
  const replacements = buildReplacements(options);
  const changes = new Map();
  const files = textFiles(root);

  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (text.includes("\u0000")) continue;

    let next = text;
    const applied = [];
    for (const [from, to] of replacements) {
      if (!next.includes(from)) continue;
      next = next.split(from).join(to);
      applied.push(`${from} -> ${to}`);
    }

    if (next === text) continue;
    const rel = relative(root, file).split("\\").join("/");
    changes.set(rel, applied);
    if (!dryRun) writeFileSync(file, next);
  }

  return changes;
}

function updatePackageMetadata(options, dryRun) {
  const { repo, owner } = options;
  if (!repo) return [];
  const homepage = repo.replace(/\.git$/, "");
  const changed = [];

  for (const file of ["package.json", "shared/package.json", "server/package.json", "client/package.json"]) {
    const full = join(root, file);
    const pkg = readJson(full);
    const before = JSON.stringify(pkg);
    pkg.repository = { type: "git", url: repo };
    pkg.homepage = `${homepage}#readme`;
    pkg.bugs = { url: `${homepage}/issues` };
    if (owner) pkg.author = owner;
    const after = JSON.stringify(pkg);
    if (before === after) continue;
    changed.push(file);
    if (!dryRun) writeFileSync(full, `${JSON.stringify(pkg, null, 2)}\n`);
  }

  return changed;
}

function replaceReadmeSection(options, dryRun) {
  const file = join(root, "README.md");
  if (!existsSync(file)) return false;
  const text = readFileSync(file, "utf8");
  if (!/## Author/.test(text)) return false;
  const maintainer = options.owner
    ? `GitHub: [@${options.owner}](https://github.com/${options.owner})`
    : options.name;
  const next = text.replace(
    /## Author[\s\S]*?(?=## License)/,
    `## Maintainer\n\n${maintainer}\n\n`,
  );
  if (next === text) return false;
  if (!dryRun) writeFileSync(file, next);
  return true;
}

function randomSecret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

function envFromExample(relativePath, overrides) {
  const example = readFileSync(join(root, relativePath), "utf8");
  const seen = new Set();
  const lines = example.split("\n").map((line) => {
    const match = /^([A-Z0-9_]+)=/.exec(line);
    if (!match) return line;
    const key = match[1];
    if (!(key in overrides)) return line;
    seen.add(key);
    return `${key}=${overrides[key]}`;
  });
  for (const [key, value] of Object.entries(overrides)) {
    if (!seen.has(key)) lines.push(`${key}=${value}`);
  }
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

function writeEnvironment(options, dryRun, force = false) {
  const rootPassword = randomSecret(18);
  const databasePassword = randomSecret(18);
  const sessionSecret = randomSecret(32);
  const originSecret = randomSecret(24);

  const serverEnvPath = join(root, "server/.env");
  const clientEnvPath = join(root, "client/.env");
  const plan = [];

  if (!existsSync(serverEnvPath) || force) {
    plan.push("server/.env");
    if (!dryRun) {
      writeFileSync(
        serverEnvPath,
        envFromExample("server/.env.example", {
          DATABASE_URL: `mysql://app_runtime:${databasePassword}@localhost:3306/app`,
          MIGRATE_DATABASE_URL: `mysql://app_runtime:${databasePassword}@localhost:3306/app`,
          MYSQL_ROOT_PASSWORD: rootPassword,
          MYSQL_PASSWORD: databasePassword,
          SESSION_SECRET: sessionSecret,
          ORIGIN_SECRET: originSecret,
          SERVICE_NAME: options.image,
          OTEL_SERVICE_NAME: options.image,
          CORS_ORIGINS: "http://localhost:2173",
        }),
      );
    }
  }

  if (!existsSync(clientEnvPath) || force) {
    plan.push("client/.env");
    if (!dryRun) {
      writeFileSync(
        clientEnvPath,
        envFromExample("client/.env.example", {
          VITE_API_URL: "/api",
          VITE_APP_NAME: options.name,
          VITE_APP_SLUG: options.slug,
          VITE_BRAND_COLOR: options.brand,
          VITE_DEFAULT_LOCALE: options.locale,
          ORIGIN_SECRET: originSecret,
          VITE_PROXY_TARGET: "http://localhost:3000",
        }),
      );
    }
  }

  return plan;
}

function run(command, args, options = {}) {
  const label = [command, ...args].join(" ");
  console.log(`[init] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    ...options,
  });
  if (result.error) fail(`${label} failed: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} failed with exit code ${result.status}`);
  return result;
}

function startDatabase() {
  run("docker", ["compose", "-f", "compose.dev.yaml", "up", "-d", "mariadb"]);
  const id = spawnSync(
    "docker",
    ["compose", "-f", "compose.dev.yaml", "ps", "-q", "mariadb"],
    { cwd: root, encoding: "utf8" },
  ).stdout.trim();
  if (!id) fail("could not find the development MariaDB container");

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = spawnSync(
      "docker",
      ["inspect", "--format", "{{.State.Health.Status}}", id],
      { encoding: "utf8" },
    );
    if (result.status !== 0) break;
    const status = result.stdout.trim();
    if (status === "healthy") {
      console.log("[init] MariaDB is healthy");
      return;
    }
    if (status === "unhealthy") fail("MariaDB reported unhealthy");
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  }
  fail("timed out waiting for MariaDB to become healthy");
}

function bootstrapAndSeed() {
  run("npm", ["run", "bootstrap"]);
  run("npm", ["--prefix", "server", "run", "db:deploy"]);

  const seed = spawnSync("npm", ["--prefix", "server", "run", "db:seed"], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
  if (seed.status !== 0) {
    process.stderr.write(seed.stdout ?? "");
    process.stderr.write(seed.stderr ?? "");
    fail("seed failed");
  }

  const output = `${seed.stdout ?? ""}\n${seed.stderr ?? ""}`;
  const email = /Email:\s+(\S+)/.exec(output)?.[1];
  const password = /Password:\s+(\S+)/.exec(output)?.[1];

  if (email && password) {
    console.log("");
    console.log("[init] First administrator created.");
    console.log(`[init]   Email:    ${email}`);
    console.log(`[init]   Password: ${password}`);
    console.log("[init] This one-time password is shown only once.");
    console.log("[init] The first login forces a password change.");
    console.log("");
    return;
  }

  const summary = (seed.stdout ?? "").trim();
  if (summary) console.log(`[init] ${summary}`);
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const dryRun = Boolean(flags["dry-run"]);

  if (existsSync(markerPath) && !flags.force) {
    fail(
      "this repository is already initialized (.template-initialized exists); use --force to re-run",
    );
  }

  const options = await resolveOptions(flags);

  if (dryRun) {
    console.log("[init] dry run: no files will be written");
  }
  console.log(`[init] project: ${options.name} (${options.slug})`);
  console.log(`[init] image:   ${options.image}`);
  if (options.repo) console.log(`[init] repo:    ${options.repo}`);

  const changes = planAndApply(options, dryRun);
  for (const [file, replacements] of changes) {
    console.log(`[init] ${dryRun ? "would update" : "updated"} ${file}`);
    for (const replacement of replacements) console.log(`[init]   ${replacement}`);
  }

  const metadata = updatePackageMetadata(options, dryRun);
  for (const file of metadata) {
    console.log(`[init] ${dryRun ? "would update" : "updated"} ${file} (repository metadata)`);
  }

  if (replaceReadmeSection(options, dryRun)) {
    console.log(`[init] ${dryRun ? "would update" : "updated"} README.md (maintainer)`);
  }

  const envFiles = writeEnvironment(options, dryRun, Boolean(flags.force));
  for (const file of envFiles) {
    console.log(
      `[init] ${dryRun ? "would create" : "created"} ${file} (random secrets are not printed)`,
    );
  }

  if (!dryRun) {
    writeFileSync(
      markerPath,
      `${JSON.stringify(
        {
          ...options,
          initializedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
    );
    console.log("[init] wrote .template-initialized");
  }

  if (dryRun) {
    console.log("[init] dry run complete");
    return;
  }

  if (!flags["no-db"]) startDatabase();

  if (!flags["no-install"]) {
    if (flags["no-db"]) {
      console.log(
        "[init] --no-db set: skipping migrate and seed. Run npm run bootstrap, then db:deploy and db:seed with a database.",
      );
      run("npm", ["run", "bootstrap"]);
    } else {
      bootstrapAndSeed();
    }
  }

  console.log("");
  console.log("[init] Next steps:");
  console.log("[init]   npm run doctor");
  console.log("[init]   npm run dev");
  console.log("[init]   read docs/template-usage.md");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "unexpected error");
});
