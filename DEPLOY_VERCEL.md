# Deploy Elorakart to Vercel (demo)

Follow these steps in order. Total time ~20–40 minutes.

---

## Step 0 — What you need

- GitHub account
- Vercel account (sign up with GitHub at https://vercel.com)
- Neon account for free Postgres (https://neon.tech) — or Vercel’s own Postgres

SQLite does **not** work on Vercel. This project is set to **PostgreSQL**.

---

## Step 1 — Create a free Postgres database (Neon)

1. Go to https://neon.tech → Sign up / Log in  
2. **Create project** → name it `elorakart`  
3. Copy the **connection string** (looks like):
   ```
   postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
   ```
4. Keep it handy — you’ll paste it into Vercel and optionally into local `.env`

---

## Step 2 — Put the project on GitHub

In PowerShell (from the project folder):

```powershell
cd C:\Users\balme\OneDrive\Desktop\elorakart
git init
git add .
git commit -m "Prepare Elorakart for Vercel demo deploy"
```

Then on GitHub:

1. https://github.com/new → create repo `elorakart` (private is fine)  
2. Do **not** add README/license (repo should be empty)  
3. Connect and push:

```powershell
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/elorakart.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 3 — Import project on Vercel

1. https://vercel.com/new  
2. **Import** the `elorakart` GitHub repo  
3. Framework: **Next.js** (auto-detected)  
4. **Do not deploy yet** — click **Environment Variables** first  

---

## Step 4 — Add environment variables on Vercel

In the Vercel project → **Settings → Environment Variables**, add these for **Production** (and Preview if you want):

| Name | Value |
|------|--------|
| `DATABASE_URL` | Neon connection string from Step 1 |
| `AUTH_SECRET` | Run locally: `openssl rand -base64 32` (or any long random string) |
| `AUTH_URL` | Leave blank for first deploy, then set to `https://YOUR-APP.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | Same as `AUTH_URL` after first deploy |
| `ADMIN_EMAIL` | Your Gmail (admin bootstrap + CC on order emails) |
| `ADMIN_DEV_BYPASS` | `true` (so you can open `/admin` without Google for the demo) |
| `RESEND_API_KEY` | From https://resend.com (required for order emails) |
| `EMAIL_FROM` | e.g. `Elorakart <onboarding@resend.dev>` or a verified domain sender |
| `GEMINI_API_KEY` | Google AI Studio / Gemini API key for the support chatbot |

Optional for demo (can leave empty):

- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
- Razorpay / Shiprocket keys
- Without `GEMINI_API_KEY`, chat still answers FAQs from the knowledge base and can create tickets
Then click **Deploy**.

---

## Step 5 — After first deploy succeeds

1. Open the URL Vercel gives you, e.g. `https://elorakart-xxx.vercel.app`  
2. Go back to Vercel → **Settings → Environment Variables** and set:
   - `AUTH_URL` = `https://elorakart-xxx.vercel.app`
   - `NEXT_PUBLIC_APP_URL` = same  
3. **Redeploy** (Deployments → … → Redeploy) so those URLs apply  

---

## Step 6 — Seed the catalog (products + blogs)

Vercel builds the empty tables (`prisma db push` runs on build). You still need seed data once.

### Option A — from your PC (easiest)

```powershell
cd C:\Users\balme\OneDrive\Desktop\elorakart
# Temporarily put the SAME Neon DATABASE_URL into .env
npx prisma db push
npm run db:seed
```

### Option B — Vercel CLI

```powershell
npm i -g vercel
vercel login
vercel link
vercel env pull .env.vercel
# copy DATABASE_URL from .env.vercel into a one-off command, then:
$env:DATABASE_URL="paste-neon-url-here"; npm run db:seed
```

Refresh the live site — you should see products on the homepage.

---

## Step 7 — Demo checklist

| Page | URL |
|------|-----|
| Storefront | `https://YOUR-APP.vercel.app` |
| Shop | `/products` |
| Sale | `/sale` |
| Admin | `/admin` (works with `ADMIN_DEV_BYPASS=true`) |
| Checkout | Use cart → checkout (demo pay if Razorpay empty) |

---

## Step 8 — Optional: Google login on the live site

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)  
2. OAuth client → Authorized redirect URIs add:
   ```
   https://YOUR-APP.vercel.app/api/auth/callback/google
   ```
3. Put Client ID / Secret into Vercel as `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`  
4. Redeploy  
5. Set `ADMIN_DEV_BYPASS=false` when Google works  

---

## Common errors

| Error | Fix |
|-------|-----|
| Build fails on Prisma / DB | `DATABASE_URL` missing or wrong on Vercel |
| Empty storefront | Seed not run (Step 6) |
| Google `client_id` missing | Empty `AUTH_GOOGLE_ID` — use admin bypass for demo |
| Upload images fail on Vercel | Expected — filesystem is ephemeral; seeded `/public/products` images still work |

---

## After the demo

- Leave it on Vercel free tier, or delete the project  
- Later move to Hostinger: switch Prisma `provider` to `mysql` and point `DATABASE_URL` at Hostinger MySQL  

Need help with a specific step? Say which step number you’re on.
