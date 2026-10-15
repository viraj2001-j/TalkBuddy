import prisma from "@/lib/db";

export interface BanCheckResult {
  isBanned: boolean;
  reason: string | null;
}

/**
 * Checks if a Telegram user is banned from TalkBuddy.
 */
export async function checkUserBan(
  telegramUserId: bigint | number
): Promise<BanCheckResult> {
  const user = await prisma.user.findUnique({
    where: {
      telegramUserId: BigInt(telegramUserId),
    },
    select: {
      isBanned: true,
      banReason: true,
    },
  });

  if (user && user.isBanned) {
    return {
      isBanned: true,
      reason: user.banReason || "Violation of community rules",
    };
  }

  return {
    isBanned: false,
    reason: null,
  };
}

/**
 * Sends a standard ban notification to a banned user.
 */
export async function sendBanMessage(ctx: any, reason: string | null) {
  try {
    const text =
      `🚫 <b>Access Restricted / Account Suspended</b>\n\n` +
      `Your TalkBuddy account has been suspended by an administrator.\n` +
      `<b>Reason:</b> ${reason || "Violation of platform guidelines"}\n\n` +
      `You are restricted from chatting, queueing, or earning rewards.`;

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery("Account Suspended", { show_alert: true });
      await ctx.editMessageText(text, { parse_mode: "HTML" });
    } else {
      await ctx.reply(text, { parse_mode: "HTML" });
    }
  } catch (err) {
    console.error("Failed to send ban message:", err);
  }
}
