import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Telegraf } from "telegraf";
import { setupBotMenu } from "../lib/telegram/menu";
import { registerStartHandler } from "../lib/telegram/handlers/start";
import { registerCallbackHandlers } from "../lib/telegram/handlers/callbacks";
import { registerEndHandler } from "../lib/telegram/handlers/end";
import { registerNextHandler } from "../lib/telegram/handlers/next";
import { registerVipHandler } from "../lib/telegram/handlers/vip";
import { registerEarnHandler } from "../lib/telegram/handlers/earn";
import { registerReportHandler } from "../lib/telegram/handlers/report";
import { registerFeatureHandlers } from "../lib/telegram/handlers/features";
import { registerPaymentHandlers } from "../lib/telegram/handlers/payment";
import { registerVipOnboardingHandlers } from "../lib/telegram/handlers/vip-onboarding";
import { registerMessageHandler } from "../lib/telegram/handlers/messages";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN missing in environment");
  process.exit(1);
}

const bot = new Telegraf(token);

registerStartHandler(bot);
registerCallbackHandlers(bot);
registerVipHandler(bot);
registerEarnHandler(bot);
registerEndHandler(bot);
registerNextHandler(bot);
registerReportHandler(bot);
registerFeatureHandlers(bot);
registerPaymentHandlers(bot);
registerVipOnboardingHandlers(bot);
registerMessageHandler(bot);

async function start() {
  console.log("🔄 Clearing old Telegram webhook...");
  await bot.telegram.deleteWebhook({ drop_pending_updates: true });
  await setupBotMenu(bot);
  console.log("🚀 Starting TalkBuddy bot in Long Polling mode...");
  await bot.launch(() => {
    console.log("✅ Bot is active and listening for messages!");
  });
}

start().catch(console.error);

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

