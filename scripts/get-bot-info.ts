import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN missing");
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const data = await res.json();
  console.log("=== TELEGRAM BOT INFO ===");
  console.log(JSON.stringify(data, null, 2));

  const webhookInfo = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const webhookData = await webhookInfo.json();
  console.log("=== WEBHOOK INFO ===");
  console.log(JSON.stringify(webhookData, null, 2));
}

main().catch(console.error);
