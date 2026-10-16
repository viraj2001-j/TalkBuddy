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

let botInstance: Telegraf | null = null;

export function getBot(): Telegraf {
  if (botInstance) return botInstance;

  const currentToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!currentToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing in environment variables");
  }

  const bot = new Telegraf(currentToken);

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

  botInstance = bot;
  return bot;
}

// Lazy bot proxy: only instantiates when accessed at runtime, preventing eager build-time execution
export const bot = new Proxy({} as Telegraf, {
  get(_target, prop) {
    return (getBot() as any)[prop];
  },
});