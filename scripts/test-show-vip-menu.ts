import prisma from "../lib/db";
import { showVipMenu } from "../lib/telegram/handlers/vip";

async function main() {
  console.log("Testing showVipMenu directly...");

  // Get or create a user in DB
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log("No user in DB to test");
    return;
  }

  console.log("Found user:", user.id, "telegramUserId:", user.telegramUserId.toString());

  // Test 1: showVipMenu as a command (ctx.reply)
  const mockCtxCommand = {
    from: { id: Number(user.telegramUserId) },
    reply: async (text: string, extra: any) => {
      console.log("ctx.reply called with text length:", text.length);
      console.log("reply_markup buttons count:", extra?.reply_markup?.inline_keyboard?.length);
    },
    callbackQuery: null,
  };

  await showVipMenu(mockCtxCommand);

  // Test 2: showVipMenu as a callbackQuery (ctx.editMessageText)
  const mockCtxCallback = {
    from: { id: Number(user.telegramUserId) },
    callbackQuery: { id: "cb_123" },
    answerCbQuery: async () => {},
    editMessageText: async (text: string, extra: any) => {
      console.log("ctx.editMessageText called with text length:", text.length);
      console.log("reply_markup buttons count:", extra?.reply_markup?.inline_keyboard?.length);
    },
    reply: async (text: string) => {
      console.log("fallback reply called:", text);
    },
  };

  await showVipMenu(mockCtxCallback);

  console.log("showVipMenu completed successfully!");
}

main().catch(console.error);
