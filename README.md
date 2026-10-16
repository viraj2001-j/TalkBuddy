# TalkBuddy

TalkBuddy is an anonymous social chat system integrated with Telegram and a modern web dashboard.

## Features
- **Anonymous Telegram Chat**: Match, chat, and connect anonymously.
- **VIP Subscriptions**: Priority matching queue, gender and country filters, unlimited messaging.
- **Points & Rewards**: Daily bonus, referrals, and internal points shop.
- **Telegram Stars Payments**: Native in-app Stars payments with instant fulfillment and idempotency protection.
- **Web Dashboard**: Public landing page, purchase receipts, and administration portal.

## Tech Stack
- Next.js (App Router, Turbopack)
- Telegraf (Telegram Bot API via Serverless Webhooks)
- PostgreSQL (Neon / Supabase) & Prisma ORM 7
- TailwindCSS

---

## 🚀 Deploying on Vercel

TalkBuddy is architected for **zero-downtime, serverless execution on Vercel** using Next.js App Router and Telegram Webhooks.

### 1. Push Code to GitHub / Git Provider
Ensure all code and your latest commits are pushed to your remote repository:
```bash
git add .
git commit -m "Configure TalkBuddy for Vercel deployment"
git push origin main
```

### 2. Import Project into Vercel
1. Log in to [vercel.com](https://vercel.com) and click **"Add New Project"**.
2. Select your `talkbuddy` repository.
3. Keep the default settings:
   - **Framework Preset**: Next.js
   - **Build Command**: `prisma generate && next build` (or leave default, defined in `vercel.json`)
   - **Install Command**: `npm install` (Vercel automatically triggers `postinstall: prisma generate`)

### 3. Add Environment Variables in Vercel
In the Vercel project configuration screen under **Environment Variables**, add the following (see [.env.example](file:///c:/Users/dell/Desktop/Lucifer/talkbuddy/.env.example)):

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | Pooled PostgreSQL connection string (e.g. Neon `-pooler` or Supabase Transaction Pooler) |
| `TELEGRAM_BOT_TOKEN` | **Yes** | Bot token from [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_BOT_USERNAME` | Recommended | Bot handle without `@` (e.g. `TalkBuddyGlobalBot`) |
| `TELEGRAM_WEBHOOK_SECRET` | Recommended | Random secret string to secure webhook traffic |
| `NEXT_PUBLIC_APP_URL` | Recommended | Your Vercel production domain (e.g. `https://talkbuddy.vercel.app`) |
| `DB_POOL_MAX` | Optional | Max connections per lambda (default: `5`) |
| `R2_ACCOUNT_ID` | Optional | Cloudflare R2 Account ID (for media uploads) |
| `R2_ACCESS_KEY_ID` | Optional | Cloudflare R2 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | Optional | Cloudflare R2 Secret Access Key |
| `R2_BUCKET_NAME` | Optional | Cloudflare R2 Bucket Name (e.g. `talkbuddy-media`) |

Click **Deploy**.

---

### 4. Switch Telegram to the Vercel Webhook
Once Vercel finishes deploying and your site is live at `https://your-project.vercel.app`:

Run the webhook setup script locally:
```bash
npm run set-webhook https://your-project.vercel.app
```

This command will:
- Register `https://your-project.vercel.app/api/telegram/webhook` with Telegram.
- Attach the webhook secret token (if configured).
- Drop any stale pending updates.
- Verify that Telegram can reach your endpoint.

### 5. Synchronize Bot Menu Commands (Optional)
To ensure the 29 command buttons and menu items appear in Telegram chat clients:
```bash
npm run sync-menu
```
Or trigger it via the admin API route:
```bash
curl -X POST https://your-project.vercel.app/api/admin/bot-menu
```

### 6. Health Check Endpoint
You can visit:
`https://your-project.vercel.app/api/telegram/webhook`
in your browser. It should respond with `{ "status": "ok", "service": "TalkBuddy Telegram Webhook" }`.

