import { Telegraf } from "telegraf";
import { checkUserBan, sendBanMessage } from "./security";
import { registerStartHandler } from "./handlers/start";
import { registerCallbackHandlers } from "./handlers/callbacks";
import { registerVipHandler } from "./handlers/vip";
import { registerEarnHandler } from "./handlers/earn";
import { registerEndHandler } from "./handlers/end";
import { registerNextHandler } from "./handlers/next";
import { registerMessageHandler } from "./handlers/messages";
import { registerReportHandler } from "./handlers/report";
import { registerFeatureHandlers } from "./handlers/features";
import { registerPaymentHandlers } from "./handlers/payment";
import { registerVipOnboardingHandlers } from "./handlers/vip-onboarding";
import { setupBotMenu } from "./menu";

const token = process.env.TELEGRAM_BOT_TOKEN;

let botInstance: Telegraf | null = null;

export function getBot(): Telegraf {
  if (botInstance) return botInstance;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing");
  }

  const bot = new Telegraf(token);

  // Enforce security ban check on all incoming messages and callbacks
  bot.use(async (ctx, next) => {
    if (ctx.from?.id) {
      const ban = await checkUserBan(ctx.from.id);
      if (ban.isBanned) {
        await sendBanMessage(ctx, ban.reason);
        return;
      }
    }
    return next();
  });

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

  // Synchronize Telegram command menu with Telegram Bot API
  setupBotMenu(bot).catch((err) => {
    console.error("Failed to automatically synchronize bot menu:", err);
  });

  botInstance = bot;
  return bot;
}

export const bot = token ? getBot() : (null as any);