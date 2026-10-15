import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const inputUrl = process.argv[2];
if (!inputUrl) {
  console.log("Usage: npx tsx scripts/set-webhook.ts https://YOUR-NGROK-URL.ngrok-free.app");
  process.exit(1);
}

const fullUrl = inputUrl.endsWith("/api/telegram/webhook")
  ? inputUrl
  : `${inputUrl.replace(/\/$/, "")}/api/telegram/webhook`;

fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(fullUrl)}`)
  .then((r) => r.json())
  .then((res) => {
    console.log("Result:", res);
  })
  .catch(console.error);

