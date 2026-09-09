# Deploy Alpainoo on Cloudflare Workers (free plan)

Stack: **OpenNext** → Cloudflare Workers, **D1** (SQLite) for data. Product images: **D1 BLOB** by default (compressed admin uploads); optional **R2** later.
Cloudflare Email Routing is receive-only — use **Resend** or **MailChannels** to send mail.

Use the **Alpainoo Cloudflare account** (`npx wrangler login`).

---

## 1. One-time Cloudflare login

```bash
npm install
npx wrangler logout   # if logged into the wrong account
npx wrangler login    # Alpainoo Cloudflare email
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

Until R2 is enabled, admin uploads are **resized in the browser** (WebP ≤ ~500 KB) and stored as **BLOB rows** in D1 (`StoredImage`), served at `/api/media/{id}`. Apply `prisma/migrations/0004_stored_images.sql` on remote D1. Stay well under D1’s **2 MB per-row** limit and **500 MB** free DB size.

After enabling R2, uncomment in `wrangler.jsonc`:

```jsonc
"r2_buckets": [{ "binding": "UPLOADS", "bucket_name": "alpainoo-uploads" }]
```

Then create the bucket and redeploy:

```bash
npx wrangler r2 bucket create alpainoo-uploads
npm run cf:deploy
```

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
npx wrangler secret put SMTP_HOST
npx wrangler secret put SMTP_PORT
npx wrangler secret put SMTP_USER
npx wrangler secret put SMTP_PASS
npx wrangler secret put SMTP_FROM_NAME
npx wrangler secret put SMTP_FROM_EMAIL
npx wrangler secret put SMTP_SECURE
npx wrangler secret put OTP_PEPPER
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put RAZORPAY_KEY_ID
npx wrangler secret put RAZORPAY_KEY_SECRET
npx wrangler secret put RAZORPAY_WEBHOOK_SECRET
npx wrangler secret put NEXT_PUBLIC_RAZORPAY_KEY_ID
npx wrangler secret put SHIPROCKET_API_EMAIL
npx wrangler secret put SHIPROCKET_API_PASSWORD
npx wrangler secret put SHIPROCKET_PICKUP_LOCATION
# Legacy aliases still supported if set instead:
# npx wrangler secret put SHIPROCKET_EMAIL
# npx wrangler secret put SHIPROCKET_PASSWORD
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put WHATSAPP_TOKEN
npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
npx wrangler secret put NEXT_PUBLIC_GA_ID
npx wrangler secret put NEXT_PUBLIC_META_PIXEL_ID
```

Notes:

- `ADMIN_EMAIL` (already listed above) is also used for **low-stock alerts**.
- `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` enable Meta Cloud API ship/paid notifications (skipped when unset).
- `NEXT_PUBLIC_GA_ID` / `NEXT_PUBLIC_META_PIXEL_ID` power client analytics pixels when consent allows.

Set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to your Worker URL, e.g. `https://alpainoo.<account>.workers.dev`.

Google OAuth redirect URI:

```text
https://alpainoo.<account>.workers.dev/api/auth/callback/google
```

**Note:** `DATABASE_URL` is **not** required on Workers — Prisma uses the `DB` D1 binding. Keep `DATABASE_URL=file:./dev.db` only for local `next dev` / seed.

---

## 4. Email (order notifications + phone OTP)

| Service | Role |
|---------|------|
| Gmail SMTP | Preferred send path when `SMTP_*` set (orders, tickets, phone OTP) |
| Resend / MailChannels | Fallback if SMTP unset or fails on Workers |
| Cloudflare Email Routing | Receive/forward only |

```env
EMAIL_PROVIDER=auto
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=app-password
SMTP_FROM_NAME=Alpainoo
SMTP_FROM_EMAIL=you@gmail.com
EMAIL_FROM="Alpainoo <you@gmail.com>"
RESEND_API_KEY=re_...
OTP_PEPPER=
```

```bash
npm run test:email -- you@example.com
```

### Phone OTP checklist

1. Configure Gmail app password + `SMTP_*` (and optional Resend fallback).
2. `npm run test:email -- you@example.com` — confirm SMTP (or fallback) works.
3. Sign in with Google → Account → send OTP → code arrives at Google email.
4. Enter 4-digit code → orbit animation → green verified tile.
5. Wrong OTP: no green; retry works. `prefers-reduced-motion`: skip orbit.
6. Change phone → must re-verify. Address phone locked to verified number.
7. Checkout blocked until verified; succeeds after.
8. Confirm OTP codes and `SMTP_PASS` never appear in logs.
9. Apply D1 migration `prisma/migrations/0011_phone_verification.sql` on deploy.

---

## 5. Deploy

```bash
npm run cf:deploy
```

Prefer **WSL/Linux** if Windows OpenNext builds are flaky.

Custom domain: Workers → **alpainoo** → Domains → add hostname, then update OAuth + `AUTH_URL`.

---

## Domain & SSL (Cloudflare Dashboard — not in-app)

There is **no** domain/DNS/renewal panel inside the Alpainoo admin app. Manage domains here:

1. Cloudflare Dashboard → **Workers & Pages** → **alpainoo** → **Settings** → **Domains & Routes** (or **Triggers** → Custom Domains).
2. Add your hostname (e.g. `www.alpainoo.com` or apex).
3. Cloudflare provisions **SSL certificates automatically** for Worker custom domains.
4. If the domain is on Cloudflare DNS: create the CNAME/route Cloudflare shows (or use “proxied” apex as instructed in the UI).
5. After the domain works over HTTPS, update secrets and Google OAuth:
   - `AUTH_URL` / `NEXT_PUBLIC_APP_URL` → `https://your-domain`
   - Google Cloud Console → OAuth redirect → `https://your-domain/api/auth/callback/google`
6. Domain **registration/renewal** stays with your registrar (or Cloudflare Registrar); renewals are not handled by the shop app.

See also [`docs/PENDING_MAJOR_FEATURES.md`](docs/PENDING_MAJOR_FEATURES.md) (in-app domain panel explicitly deferred).

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
| Uploads fail | Ensure `StoredImage` table exists (`0004_stored_images.sql`); images must be ≤600 KB after client compress; optional R2 if preferred |
| Wrong Cloudflare account | `wrangler logout` then `login` with Alpainoo email |
| Google login fails | Match `AUTH_URL` + OAuth callback to Worker URL |
| Emails skipped | Set `RESEND_API_KEY` or `MAILCHANNELS_API_KEY` |

**Live Worker (current):** https://alpainoo.alpainoocompany.workers.dev

Audit tables are filled by **app code** (`lib/logging/db-audit.ts`). Postgres trigger SQL is not used on D1.
