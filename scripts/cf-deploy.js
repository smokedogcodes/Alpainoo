/**
 * Build + deploy to Cloudflare Workers.
 * Hides .env during build so local DATABASE_URL / secrets are not baked into the Worker.
 * Secrets should be set with `wrangler secret put`.
 *
 * Note: Prisma's WASM engine (~2MB) exceeds the free Workers 3 MiB limit, so shop
 * pages use raw D1 (`lib/db/*`) on Cloudflare instead of Prisma.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
const envBackup = path.join(root, ".env.cf-deploy-backup");

function restoreEnv() {
  if (fs.existsSync(envBackup)) {
    fs.renameSync(envBackup, envPath);
    console.log("Restored .env.");
  }
}

function scrubBakedDatabaseUrl() {
  const candidates = [
    path.join(root, ".open-next/cloudflare/next-env.mjs"),
    path.join(root, ".open-next/server-functions/default/next-env.mjs"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    let text = fs.readFileSync(file, "utf8");
    const before = text;
    text = text.replace(
      /["']DATABASE_URL["']\s*:\s*["'][^"']*["']/g,
      `"DATABASE_URL": ""`
    );
    text = text.replace(
      /DATABASE_URL\s*=\s*["']file:[^"']*["']/g,
      `DATABASE_URL=""`
    );
    if (text !== before) {
      fs.writeFileSync(file, text);
      console.log("Scrubbed DATABASE_URL from", path.relative(root, file));
    }
  }
}

function run(cmd, args, extraEnv = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    restoreEnv();
    process.exit(result.status || 1);
  }
}

try {
  if (fs.existsSync(envPath)) {
    fs.renameSync(envPath, envBackup);
    console.log("Temporarily moved .env aside for Cloudflare build.");
  }

  const buildEnv = {
    CF_DEPLOY: "1",
    DATABASE_URL: "file:./prisma/cf-build-placeholder.db",
    AUTH_SECRET: process.env.AUTH_SECRET || "cf-build-placeholder-rotate-me",
    AUTH_URL: process.env.AUTH_URL || "https://alpainoo.smokedog.workers.dev",
    AUTH_TRUST_HOST: "true",
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL || "https://alpainoo.smokedog.workers.dev",
  };

  const placeholderDb = path.join(root, "prisma", "cf-build-placeholder.db");
  if (!fs.existsSync(placeholderDb)) {
    fs.writeFileSync(placeholderDb, "");
  }

  run("npx", ["opennextjs-cloudflare", "build"], buildEnv);
  scrubBakedDatabaseUrl();
  run("npx", ["opennextjs-cloudflare", "deploy"], buildEnv);
} catch (err) {
  console.error(err);
  restoreEnv();
  process.exit(1);
}

restoreEnv();
