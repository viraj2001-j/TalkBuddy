import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const inputUrl = process.argv[2] || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
if (!inputUrl) {
  console.log("Usage: npx tsx scripts/set-webhook.ts https://your-project.vercel.app");
  console.log("Or provide NEXT_PUBLIC_APP_URL in your .env / .env.local");
  process.exit(1);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("❌ Error: TELEGRAM_BOT_TOKEN missing in environment variables.");
  process.exit(1);
}

// Clean and normalize input URL
const cleanUrl = inputUrl.startsWith("http") ? inputUrl : `https://${inputUrl}`;
const fullUrl = cleanUrl.endsWith("/api/telegram/webhook")
  ? cleanUrl
  : `${cleanUrl.replace(/\/$/, "")}/api/telegram/webhook`;

const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

async function setWebhook() {
  console.log(`📡 Setting Telegram Webhook to: ${fullUrl}`);

  let setUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(fullUrl)}&drop_pending_updates=true`;
  if (secret) {
    setUrl += `&secret_token=${encodeURIComponent(secret)}`;
    console.log("🔒 Secured with TELEGRAM_WEBHOOK_SECRET");
  }

  const response = await fetch(setUrl);
  const result = await response.json();
  console.log("Result:", result);

  if (!result.ok) {
    console.error("❌ Telegram rejected webhook registration:", result.description);
    return;
  }

  console.log("✅ Webhook successfully configured with Telegram!");

  // Verify webhook status
  console.log("\n🔍 Verifying current Telegram webhook info...");
  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const info = await infoRes.json();
  console.log("Webhook Info:", info);
}

setWebhook().catch(console.error);

