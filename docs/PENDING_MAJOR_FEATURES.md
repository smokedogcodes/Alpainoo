# Pending major features (deferred)

Features from the Alpainoo requirements that are **intentionally not** in the active build stream.
Update this file whenever something is deferred again.

| Feature | Why deferred | Notes |
|---|---|---|
| **Meta Ads management** (create/run/monitor FB/IG campaigns in-app) | Requires Meta Marketing API, Business Manager access, and is a product of its own | Use Meta Ads Manager; link from admin later if needed |
| **YouTube Ads management** | Google Ads API + YouTube campaigns; large scope | Use Google Ads / YouTube Ads UI |
| **Unified ad spend / reach dashboard** | Depends on Meta + YouTube APIs above | Revisit after channel APIs exist |
| **In-app domain DNS / renew / SSL panel** | Declined — domains stay in Cloudflare Dashboard | See `DEPLOY_CLOUDFLARE.md` → Domain & SSL |
| **Multi-currency** | Only needed if selling internationally | INR + Razorpay is current scope |
| **Full SEO keyword-rank product** (Ahrefs-class) | Third-party rank APIs and cost | Use Google Search Console / GA instead |

## Lightweight substitutes already planned / in stream

- **Email marketing (lite):** subscriber list + Resend campaigns (not a full ESP).
- **SEO panel:** meta fields, sitemap, robots, JSON-LD, GEO-friendly content (not keyword-rank SaaS).
- **Analytics:** admin sales reports + GA / Meta Pixel (not in-app ad spend).
