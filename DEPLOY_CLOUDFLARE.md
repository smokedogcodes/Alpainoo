# Deploy Elorakart on Cloudflare Workers

This app runs on **Cloudflare Workers** via the [OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare). Database stays on **Neon PostgreSQL** (same as Vercel).

Use the **elorakart Cloudflare account** (the email you use for Cloudflare login).

---

## Important: email on Cloudflare

| Service | Free? | Sends order emails? |
|---------|-------|---------------------|
| **Cloudflare Email Routing** | Yes | **No** — receive/forward only (`contact@` → Gmail) |
| **Resend** (recommended) | ~100/day | **Yes** — official Cloudflare Workers partner |
| **MailChannels** | 100/day | **Yes** — API key + domain DNS on Cloudflare |

The app supports **Resend** and **MailChannels**. Set `EMAIL_PROVIDER=auto` (default) to try MailChannels first, then Resend.

---

## 1. Prerequisites

- Node.js 18.17+
- Cloudflare account (log in with elorakart email)
- Domain added to Cloudflare (e.g. `elorakart.com` or a subdomain)
- Neon `DATABASE_URL` (unchanged)
- Google OAuth credentials (same as Vercel)
- Razorpay / Shiprocket / Gemini keys (same as Vercel)

---

## 2. One-time Cloudflare login

```bash
npm install
npx wrangler login
```

Browser opens → sign in with the **elorakart** Cloudflare account → allow access.

---

## 3. Configure email (fix “emails not sending”)

### Option A — Resend (recommended, works on Cloudflare + Vercel)

1. Sign up at [resend.com](https://resend.com) (free tier).
2. **Domains** → Add your domain (must use Cloudflare DNS).
3. Copy Resend’s **SPF, DKIM, DMARC** records into **Cloudflare → DNS → Records**.
4. Click **Verify** in Resend until domain shows **Verified**.
5. **API Keys** → Create key → copy `RESEND_API_KEY`.
6. Set sender:

   ```env
   EMAIL_FROM="Elorakart <orders@yourdomain.com>"
   RESEND_API_KEY="re_..."
   EMAIL_PROVIDER="resend"
   ```

7. Test locally:

   ```bash
   npm run test:email -- elorakart1@gmail.com
   ```

> Without a verified domain, Resend only sends to addresses you verified in the Resend dashboard — order emails to customers will fail.

### Option B — MailChannels (100 free emails/day)

1. Sign up at [mailchannels.com](https://www.mailchannels.com/).
2. Add and verify your domain (SPF/DKIM/Domain Lockdown in Cloudflare DNS).
3. Create an API key → `MAILCHANNELS_API_KEY`.
4. Set:

   ```env
   EMAIL_FROM="Elorakart <orders@yourdomain.com>"
   MAILCHANNELS_API_KEY="..."
   EMAIL_PROVIDER="mailchannels"
   ```

### Optional — receive mail with Cloudflare Email Routing

Cloudflare Dashboard → **Email** → **Email Routing** → route `contact@yourdomain.com` → `elorakart1@gmail.com`.  
This does **not** send order confirmations; use Resend/MailChannels for that.

---

## 4. Set Worker secrets (production env)

Copy `.dev.vars.example` → `.dev.vars` for local Cloudflare preview, then push secrets to Workers:

```bash
# Required
npx wrangler secret put DATABASE_URL
npx wrangler secret put AUTH_SECRET
npx wrangler secret put AUTH_GOOGLE_ID
npx wrangler secret put AUTH_GOOGLE_SECRET
npx wrangler secret put AUTH_URL
npx wrangler secret put NEXT_PUBLIC_APP_URL
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EMAIL_FROM

# Payments / shipping / chat (same as Vercel)
npx wrangler secret put RAZORPAY_KEY_ID
npx wrangler secret put RAZORPAY_KEY_SECRET
npx wrangler secret put RAZORPAY_WEBHOOK_SECRET
npx wrangler secret put NEXT_PUBLIC_RAZORPAY_KEY_ID
npx wrangler secret put SHIPROCKET_EMAIL
npx wrangler secret put SHIPROCKET_PASSWORD
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put ADMIN_EMAIL
```

`AUTH_URL` and `NEXT_PUBLIC_APP_URL` = your Cloudflare URL, e.g. `https://elorakart.your-subdomain.workers.dev` or custom domain.

Update **Google OAuth** authorized redirect URI:

```text
https://YOUR-CLOUDFLARE-URL/api/auth/callback/google
```

---

## 5. Deploy

```bash
npm run cf:deploy
```

First deploy may take a few minutes. Wrangler prints the live URL.

### Custom domain

Cloudflare Dashboard → **Workers & Pages** → **elorakart** → **Settings** → **Domains & Routes** → Add `elorakart.com` (or subdomain).

Then update `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and Google OAuth redirect to the custom domain.

---

## 6. Preview locally (Workers runtime)

```bash
npm run cf:preview
```

Uses `.dev.vars` for bindings/secrets.

---

## 7. GitHub auto-deploy (optional)

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → Connect GitHub repo `elorakart/Elorakart`.
2. Build command: `npm run cf:deploy` or use OpenNext’s documented CI setup.
3. Add all secrets in **Settings → Variables and Secrets**.

---

## 8. Vercel vs Cloudflare

You can keep Vercel as backup. Use the **same Neon database** and **same email keys**. Only change `AUTH_URL` / `NEXT_PUBLIC_APP_URL` per host.

| Command | Platform |
|---------|----------|
| `npx vercel --prod` | Vercel |
| `npm run cf:deploy` | Cloudflare Workers |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Emails skipped in logs | Set `RESEND_API_KEY` or `MAILCHANNELS_API_KEY` on the host |
| Resend “domain not verified” | Add DNS records in Cloudflare, verify in Resend |
| Google login fails | `AUTH_URL` must match live URL; add callback URI in Google Console |
| Build fails on Cloudflare | Ensure `@opennextjs/cloudflare` and `wrangler` are installed |
| Prisma errors | `DATABASE_URL` must be set as a Worker **secret** |

Run email test after any change:

```bash
npm run test:email -- your-email@gmail.com
```
