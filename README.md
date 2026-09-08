# Alpainoo

Botanical beauty e-commerce — Next.js 14, Prisma, Auth.js (Google), Razorpay, Shiprocket.
Database and file storage target: **Hostinger** (MySQL + filesystem uploads) long-term.  
**Temporary demo:** see [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) (Vercel + Neon Postgres).

## Quick start (local)

```bash
npm install
cp .env.example .env
# Local uses SQLite by default (see prisma/schema.prisma)
npm run db:push
npm run db:seed
npm run dev
```

- Storefront: http://localhost:3000  
- Admin: http://localhost:3000/admin (`ADMIN_DEV_BYPASS=true` until Google OAuth is configured)
- Support chat: floating widget on shop pages (Gemini + FAQ knowledge base). Set `GEMINI_API_KEY`.
- Admin → **Tickets** / **Knowledge** for ticket TAT replies and FAQ management.
- Seed FAQs without wiping data: `npx tsx scripts/seed-faqs.ts`

## Hostinger setup

### 1. MySQL database
1. hPanel → **Databases** → Create MySQL database + user  
2. In [`prisma/schema.prisma`](prisma/schema.prisma) set:
   ```prisma
   datasource db {
     provider = "mysql"
     url      = env("DATABASE_URL")
   }
   ```
3. Set in Hostinger env (or `.env`):
   ```env
   DATABASE_URL="mysql://USER:PASSWORD@127.0.0.1:3306/DB_NAME"
   ```
   (Use the host Hostinger shows — often `localhost` on the same VPS.)
4. On the server:
   ```bash
   npx prisma db push
   npm run db:seed
   ```

Optional local MySQL via Docker: `docker compose up -d` then  
`DATABASE_URL="mysql://alpainoo:alpainoo@127.0.0.1:3306/alpainoo"`.

### 2. File storage (product images)
Admin uploads go to `public/uploads/products/` and are served as `/uploads/products/...`.  
Ensure the Node process can write to that folder on Hostinger.

### 3. Google login (Auth.js)
1. [Google Cloud Console](https://console.cloud.google.com/) → OAuth client (Web)  
2. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR_DOMAIN/api/auth/callback/google`
3. Env:
   ```env
   AUTH_SECRET="(openssl rand -base64 32)"
   AUTH_GOOGLE_ID="..."
   AUTH_GOOGLE_SECRET="..."
   AUTH_URL="https://YOUR_DOMAIN"
   ADMIN_EMAIL="you@gmail.com"
   ADMIN_DEV_BYPASS="false"
   ```
4. The user matching `ADMIN_EMAIL` is promoted to `ADMIN` on sign-in.

### 4. Hosting note
Run Next.js with Node (`next start`) on Hostinger **VPS / Cloud / Node app** — not PHP-only shared hosting.

## Design
Stitch references: `design/stitch/` + `design/tokens.json`.
