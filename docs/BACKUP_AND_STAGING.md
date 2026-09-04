# Backup and staging (Cloudflare D1 + Workers)

## D1 database export

Export the remote D1 database to a local SQL dump:

```bash
npx wrangler d1 export alpainoo-db --remote --output=./backups/d1-YYYYMMDD.sql
```

For a local/miniflare D1:

```bash
npx wrangler d1 export alpainoo-db --local --output=./backups/d1-local.sql
```

Keep dumps out of git (add `backups/` to `.gitignore` if needed). Store copies in object storage or an encrypted drive.

## D1 restore

Create a fresh database (or wipe staging), then execute the dump:

```bash
npx wrangler d1 execute alpainoo-db --remote --file=./backups/d1-YYYYMMDD.sql
```

For schema-only migrations already in-repo:

```bash
npx wrangler d1 execute alpainoo-db --remote --file=./prisma/migrations/0002_phase2_features.sql
npx wrangler d1 execute alpainoo-db --remote --file=./prisma/migrations/0003_phase2_alters.sql
```

(`0003` may error on columns that already exist — apply missing statements one at a time.)

After restore, verify product/order counts with a read-only query or the admin reports page.

## Staging Worker notes

1. Use a separate Cloudflare account/project or a `wrangler` env (`[env.staging]`) with its own D1 binding (`DB`), R2 bucket, and secrets (`AUTH_SECRET`, `RESEND_API_KEY`, Razorpay test keys).
2. Set `NEXT_PUBLIC_APP_URL` to the staging hostname so sitemap, robots, and auth callbacks stay correct.
3. Deploy with the project’s CF script (e.g. `node scripts/cf-deploy.js` or `npx opennextjs-cloudflare` + `wrangler deploy --env staging`).
4. Do not point production custom domains at the staging Worker. Prefer `*.workers.dev` or a dedicated staging subdomain.
5. Seed staging from an anonymized D1 export; never copy live customer PII into a shared staging DB without scrubbing emails/phones.
6. After deploy, smoke-test: home, `/products`, checkout (test mode), admin login, and newsletter subscribe.

## Prisma local SQLite

Local Node/dev still uses `DATABASE_URL="file:./dev.db"`. After schema changes:

```bash
npx prisma generate
npx prisma db push
```

Workers use raw D1 SQL helpers under `lib/db/` — keep D1 migrations and Prisma schema in sync when adding tables.
