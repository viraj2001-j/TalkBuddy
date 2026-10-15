import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Telegraf } from "telegraf";
import { setupBotMenu } from "../lib/telegram/menu";

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("❌ TELEGRAM_BOT_TOKEN missing in environment");
    process.exit(1);
  }

  const bot = new Telegraf(token);

  console.log("🔍 Fetching current commands from Telegram servers...");
  const oldCommands = await bot.telegram.getMyCommands();
  console.log(`Current commands count in Telegram: ${oldCommands.length}`);
  console.log("Current commands:", oldCommands.map((c) => `/${c.command} - ${c.description}`));

  console.log("\n🔄 Updating Telegram commands with setupBotMenu...");
  await setupBotMenu(bot);

  // Also set with BotCommandScopeAllPrivateChats explicitly to ensure mobile/desktop chat menus update immediately!
  console.log("🔄 Also setting for AllPrivateChats scope...");
  const commandsList = [
    { command: "start", description: "Start a chat with a random user" },
    { command: "search", description: "👤 Finds a random user" },
    { command: "next", description: "➡️ Ends the current chat and finds a new match" },
    { command: "stop", description: "🛑 Ends the conversation" },
    { command: "end", description: "End the current chat" },
    { command: "link", description: "🔗 Send Telegram profile URL to your partner" },
    { command: "reopen", description: "🔄 Send Invites to reopen past conversations." },
    { command: "translate", description: "🌐 Translate any message you reply to your language" },
    { command: "vip", description: "👑 Become a VIP User" },
    { command: "premium", description: "💎 Buy/Manage Premium" },
    { command: "cancel", description: "🗑️ Cancel operation" },
    { command: "truth", description: "🧐 Receive a Truth question" },
    { command: "dare", description: "🎲 Receive a Dare challenge" },
    { command: "refer", description: "🧑‍🤝‍🧑 Refer a Friend to get a Free PREMIUM subscription!" },
    { command: "settings", description: "⚙️ Change your gender, age and other settings" },
    { command: "promocode", description: "🎟️ Use a promo code for premium packages" },
    { command: "about", description: "❓ To view the help, rules, and terms of the bot" },
    { command: "myid", description: "🆔 View your telegram account ID" },
    { command: "paysupport", description: "💰 Payment support" },
  ];

  await bot.telegram.setMyCommands(commandsList, {
    scope: { type: "all_private_chats" },
  });

  console.log("\n🔍 Fetching newly updated commands from Telegram servers...");
  const newCommands = await bot.telegram.getMyCommands();
  console.log(`Newly registered commands count: ${newCommands.length}`);
  console.log("Newly registered commands:", newCommands.map((c) => `/${c.command} - ${c.description}`));

  console.log("\n🎉 Telegram Bot Menu successfully synchronized with Telegram API!");
}

main().catch((err) => {
  console.error("❌ Failed to sync Telegram commands:", err);
  process.exit(1);
});
