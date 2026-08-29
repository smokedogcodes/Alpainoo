# Deploy Alpainoo on Cloudflare Workers (free plan)

Stack: **OpenNext** → Cloudflare Workers, **D1** (SQLite) for data, **R2** for product images.
Cloudflare Email Routing is receive-only — use **Resend** or **MailChannels** to send mail.

Use the **elorakart / Alpainoo Cloudflare account** (`npx wrangler login`).

---

## 1. One-time Cloudflare login

```bash
npm install
npx wrangler logout   # if logged into the wrong account
npx wrangler login    # elorakart Cloudflare email
```

---

## 2. Create D1 + R2

```bash
npx wrangler d1 create alpainoo-db
npx wrangler r2 bucket create alpainoo-uploads
```

After creating D1, enable **R2** in the Cloudflare dashboard (Storage → R2 → Purchase / Enable free tier), then:

```bash
npx wrangler r2 bucket create alpainoo-uploads
```

Add to `wrangler.jsonc`:

```jsonc
"r2_buckets": [{ "binding": "UPLOADS", "bucket_name": "alpainoo-uploads" }]
```

Until R2 is enabled, admin uploads use the local filesystem fallback (Workers have no disk — enable R2 before relying on uploads in production).

Apply schema to **remote** D1:

```bash
# Generate SQL from Prisma, then apply with wrangler:
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0001_init.sql
npx wrangler d1 execute alpainoo-db --remote --file=prisma/migrations/0001_init.sql
```

Seed catalog (optional; run against local SQLite first, or write a D1 seed script):

```bash
# Local SQLite file for next dev
set DATABASE_URL=file:./dev.db
npx prisma db push
npm run db:seed
```

For remote seed, use `wrangler d1 execute` with INSERT statements, or a small script using the D1 HTTP API.

---

## 3. Secrets

```bash
npx wrangler secret put AUTH_SECRET
npx wrangler secret put AUTH_GOOGLE_ID
npx wrangler secret put AUTH_GOOGLE_SECRET
npx wrangler secret put AUTH_URL
npx wrangler secret put NEXT_PUBLIC_APP_URL
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EMAIL_FROM
npx wrangler secret put EMAIL_PROVIDER
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put RAZORPAY_KEY_ID
npx wrangler secret put RAZORPAY_KEY_SECRET
npx wrangler secret put RAZORPAY_WEBHOOK_SECRET
npx wrangler secret put NEXT_PUBLIC_RAZORPAY_KEY_ID
npx wrangler secret put SHIPROCKET_EMAIL
npx wrangler secret put SHIPROCKET_PASSWORD
npx wrangler secret put GEMINI_API_KEY
```

Set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to your Worker URL, e.g. `https://alpainoo.<account>.workers.dev`.

Google OAuth redirect URI:

```text
https://alpainoo.<account>.workers.dev/api/auth/callback/google
```

**Note:** `DATABASE_URL` is **not** required on Workers — Prisma uses the `DB` D1 binding. Keep `DATABASE_URL=file:./dev.db` only for local `next dev` / seed.

---

## 4. Email (order notifications)

| Service | Role |
|---------|------|
| Cloudflare Email Routing | Receive/forward only |
| Resend (recommended) | Send ~100/day free — add DNS in Cloudflare |
| MailChannels | Send 100/day free |

```env
EMAIL_PROVIDER=auto
EMAIL_FROM="Alpainoo <orders@yourdomain.com>"
RESEND_API_KEY=re_...
```

```bash
npm run test:email -- you@example.com
```

---

## 5. Deploy

```bash
npm run cf:deploy
```

Prefer **WSL/Linux** if Windows OpenNext builds are flaky.

Custom domain: Workers → **alpainoo** → Domains → add hostname, then update OAuth + `AUTH_URL`.

---

## 6. Local preview (Workers runtime)

```bash
# Copy secrets into .dev.vars (never commit)
cp .dev.vars.example .dev.vars
npm run cf:preview
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Prisma / DB errors on Workers | Confirm `DB` binding + remote migrations applied |
| Uploads fail | Create R2 bucket `alpainoo-uploads`; binding `UPLOADS` |
| Wrong Cloudflare account | `wrangler logout` then `login` with elorakart email |
| Google login fails | Match `AUTH_URL` + OAuth callback to Worker URL |
| Emails skipped | Set `RESEND_API_KEY` or `MAILCHANNELS_API_KEY` |

Audit tables are filled by **app code** (`lib/logging/db-audit.ts`). Postgres trigger SQL is not used on D1.
