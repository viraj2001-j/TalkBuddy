import type { Telegraf } from "telegraf";
import prisma from "@/lib/db";
import { getPreviousPartner, getPreviousPartnerId } from "../previous-partners";

export const REPORT_REASONS: Record<string, string> = {
  spam: "Spam or Unwanted Ads",
  nsfw: "Inappropriate / Explicit Media",
  harass: "Harassment or Offensive Speech",
  scam: "Scam or Fraudulent Links",
  other: "Other Community Violations",
};

export async function handleReport(ctx: any) {
  const telegramUserId = BigInt(ctx.from.id);

  try {
    const user = await prisma.user.findUnique({
      where: { telegramUserId },
      select: { id: true },
    });

    if (!user) {
      await ctx.reply("Please use /start to set up your TalkBuddy profile first.");
      return;
    }

    // Check for active chat partner first
    const activeQueue = await prisma.matchingQueue.findUnique({
      where: { userId: user.id },
      select: { status: true, partnerUserId: true },
    });

    let targetPartnerId: string | null = null;
    if (activeQueue?.status === "MATCHED" && activeQueue.partnerUserId) {
      targetPartnerId = activeQueue.partnerUserId;
    } else {
      // Fallback to previous partner
      const prev = await getPreviousPartner(user.id);
      if (prev) {
        targetPartnerId = getPreviousPartnerId(prev, user.id);
      }
    }

    if (!targetPartnerId) {
      await ctx.reply(
        "ℹ️ <b>No Partner to Report</b>\n\n" +
          "You don't have an active or recent chat partner to report.",
        { parse_mode: "HTML" }
      );
      return;
    }

    // Show reason selection keyboard
    await ctx.reply(
      "🚨 <b>Report User / Inappropriate Behavior</b>\n\n" +
        "Help keep TalkBuddy safe and friendly. Please choose the reason for your report:",
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🚫 Spam / Ads", callback_data: `rep_act_spam_${targetPartnerId}` }],
            [{ text: "🔞 Explicit / NSFW Content", callback_data: `rep_act_nsfw_${targetPartnerId}` }],
            [{ text: "😡 Harassment / Abuse", callback_data: `rep_act_harass_${targetPartnerId}` }],
            [{ text: "💸 Scam / Fraudulent Activity", callback_data: `rep_act_scam_${targetPartnerId}` }],
            [{ text: "⚠️ Other Guidelines Violation", callback_data: `rep_act_other_${targetPartnerId}` }],
          ],
        },
      }
    );
  } catch (err) {
    console.error("Error in /report handler:", err);
    await ctx.reply("❌ Failed to initiate report. Please try again.");
  }
}

export function registerReportHandler(bot: Telegraf) {
  bot.command("report", handleReport);

  // Handle report callback actions
  bot.action(/^rep_act_([a-z]+)_(.+)$/, async (ctx) => {
    try {
      const reasonKey = ctx.match[1];
      const targetUserId = ctx.match[2];
      const reporterTgId = BigInt(ctx.from.id);

      const reporter = await prisma.user.findUnique({
        where: { telegramUserId: reporterTgId },
        select: { id: true },
      });

      if (!reporter) {
        await ctx.answerCbQuery("User profile not found.", { show_alert: true });
        return;
      }

      const reasonText = REPORT_REASONS[reasonKey] || "Community Guidelines Violation";

      // Look up active session if available
      const activeSession = await prisma.chatSession.findFirst({
        where: {
          OR: [
            { userOneId: reporter.id, userTwoId: targetUserId },
            { userOneId: targetUserId, userTwoId: reporter.id },
          ],
        },
        orderBy: { startedAt: "desc" },
        select: { id: true },
      });

      await prisma.userReport.create({
        data: {
          reporterId: reporter.id,
          reportedUserId: targetUserId,
          chatSessionId: activeSession?.id ?? null,
          reason: reasonText,
          status: "PENDING",
        },
      });

      await ctx.answerCbQuery("Report submitted successfully.");
      await ctx.editMessageText(
        "✅ <b>Report Submitted</b>\n\n" +
          `<b>Reason:</b> ${reasonText}\n\n` +
          "Thank you for helping us keep TalkBuddy safe. Our moderation team will review this case and take appropriate action.",
        { parse_mode: "HTML" }
      );
    } catch (err) {
      console.error("Error submitting report:", err);
      await ctx.answerCbQuery("Failed to submit report.", { show_alert: true });
    }
  });
}
