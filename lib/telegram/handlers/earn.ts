import type { Telegraf } from "telegraf";
import prisma from "@/lib/db";
import { getEarnMenuKeyboard } from "@/lib/telegram/menu";
import {
  claimDailyReward,
  getPointsBalance,
  processPackagePayment,
} from "@/lib/telegram/points";
import { getUserVipStatus, createPendingOrder } from "@/lib/telegram/vip";

export const showEarnMenu = async (ctx: any) => {
  try {
    const rawTgId = ctx.from?.id;
    if (!rawTgId) return;

    const telegramUserId = BigInt(rawTgId);
    let user = await prisma.user.findUnique({
      where: { telegramUserId },
      select: {
        id: true,
        firstName: true,
        pointsBalance: true,
        isVip: true,
        vipExpiresAt: true,
        referralCode: true,
      },
    });

    if (!user) {
      try {
        user = await prisma.user.create({
          data: {
            telegramUserId,
            username: ctx.from?.username ?? null,
            firstName: ctx.from?.first_name || "User",
            lastName: ctx.from?.last_name ?? null,
            referralCode: `TB${rawTgId}`,
            gender: "",
            pointsBalance: 100,
            isVip: false,
          },
          select: {
            id: true,
            firstName: true,
            pointsBalance: true,
            isVip: true,
            vipExpiresAt: true,
            referralCode: true,
          },
        });
      } catch (createErr) {
        user = await prisma.user.findUnique({
          where: { telegramUserId },
          select: {
            id: true,
            firstName: true,
            pointsBalance: true,
            isVip: true,
            vipExpiresAt: true,
            referralCode: true,
          },
        });
      }
    }

    if (!user) {
      await ctx.reply("❌ Error loading your account. Please try again.");
      return;
    }

    const vipInfo = await getUserVipStatus(user.id);
    const vipStatusText = vipInfo.isVip
      ? `👑 Active (${
          vipInfo.vipExpiresAt
            ? `Expires: ${new Date(vipInfo.vipExpiresAt).toLocaleDateString()}`
            : "Active"
        })`
      : "Free Plan";

    const message =
      `⭐ <b>TalkBuddy VIP & Telegram Stars Center</b>\n\n` +
      `👤 <b>User:</b> ${user.firstName}\n` +
      `👑 <b>VIP Status:</b> <b>${vipStatusText}</b>\n\n` +
      `TalkBuddy uses official <b>Telegram Stars (⭐)</b> for instant VIP access and premium privileges.\n\n` +
      `✨ <b>VIP Privileges:</b>\n` +
      `• 💖 <b>Gender & Country Filter:</b> Match exclusively with preferred partners\n` +
      `• 🚀 <b>Priority Queue:</b> Skip wait times and connect immediately\n` +
      `• 💬 <b>Unlimited Conversations:</b> Chat without interruption\n` +
      `• 🔄 <b>Saved Partners:</b> Save and reconnect anytime\n` +
      `• 🗑️ <b>Message Wipe:</b> Erase messages with <code>/delete</code>\n\n` +
      `👇 <i>Choose an action below to view VIP plans or invite friends:</i>`;

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(message, {
          parse_mode: "HTML",
          reply_markup: getEarnMenuKeyboard(),
        });
      } catch (err: any) {
        if (!err?.message?.includes("message is not modified")) {
          await ctx.reply(message, {
            parse_mode: "HTML",
            reply_markup: getEarnMenuKeyboard(),
          });
        }
      }
    } else {
      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: getEarnMenuKeyboard(),
      });
    }
  } catch (error) {
    console.error("Failed to show earn overview:", error);
    await ctx.reply("❌ Error opening earning center. Please try again.");
  }
};

export function registerEarnHandler(bot: Telegraf) {
  bot.command("earn", showEarnMenu);
  bot.command("points", showEarnMenu);
  bot.command("balance", showEarnMenu);

  // Callback handlers for earning and payments
  bot.action("menu_earn", async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
    } catch {}
    await showEarnMenu(ctx);
  });

  // Claim Daily Reward
  bot.action("earn_daily", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramUserId = BigInt(ctx.from.id);
      const user = await prisma.user.findUnique({
        where: { telegramUserId },
        select: { id: true, pointsBalance: true },
      });

      if (!user) {
        await ctx.reply("❌ User profile not found. Please use /start.");
        return;
      }

      const result = await claimDailyReward(user.id);

      if (result.success) {
        await ctx.editMessageText(
          `🎉 <b>Daily Reward Claimed!</b>\n\n` +
            `🎁 You received: <b>+${result.rewardPoints} Points</b>\n` +
            `💎 <b>New Balance:</b> <b>${result.newBalance} Points</b>\n\n` +
            `Come back in 24 hours to claim your next bonus!`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "⬅️ Back to Earning Menu",
                    callback_data: "menu_earn",
                  },
                ],
              ],
            },
          }
        );
      } else if (result.reason === "COOLDOWN_ACTIVE") {
        await ctx.editMessageText(
          `⏳ <b>Daily Reward Already Claimed</b>\n\n` +
            `You have already claimed today's bonus.\n` +
            `Please check back in approximately <b>${result.remainingHours} hour(s)</b>.\n\n` +
            `💎 Your current balance: <b>${user.pointsBalance} Points</b>`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "⬅️ Back to Earning Menu",
                    callback_data: "menu_earn",
                  },
                ],
              ],
            },
          }
        );
      } else {
        await ctx.reply("❌ Could not claim reward. Please try again later.");
      }
    } catch (err) {
      console.error("Daily reward error:", err);
      await ctx.reply("❌ Something went wrong while claiming your reward.");
    }
  });

  // Referral link
  bot.action("earn_referral", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const telegramUserId = BigInt(ctx.from.id);
      let user = await prisma.user.findUnique({
        where: { telegramUserId },
        select: { id: true, referralCode: true, pointsBalance: true },
      });

      if (!user) {
        await ctx.reply("❌ User profile not found. Please use /start.");
        return;
      }

      // Generate referral code if missing
      let refCode = user.referralCode;
      if (!refCode) {
        refCode = `ref_${user.id.substring(0, 8)}`;
        user = await prisma.user.update({
          where: { id: user.id },
          data: { referralCode: refCode },
          select: { id: true, referralCode: true, pointsBalance: true },
        });
      }

      const botInfo = await ctx.telegram.getMe();
      const referralLink = `https://t.me/${botInfo.username}?start=${refCode}`;

      // Count referrals
      const referralCount = await prisma.user.count({
        where: { referredById: user.id },
      });

      await ctx.editMessageText(
        `👥 <b>Invite Friends to TalkBuddy</b>\n\n` +
          `Share your personal referral link with friends. Chat anonymously and make new connections across the globe!\n\n` +
          `🔗 <b>Your Invite Link:</b>\n<code>${referralLink}</code>\n\n` +
          `📊 <b>Your Referrals:</b> ${referralCount} friends joined\n\n` +
          `Tap below to share your link with friends or groups:`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "📤 Share with Friends",
                  url: `https://t.me/share/url?url=${encodeURIComponent(
                    referralLink
                  )}&text=${encodeURIComponent(
                    "Chat anonymously with new people around the world on TalkBuddy! Join now:"
                  )}`,
                },
              ],
              [
                {
                  text: "👑 VIP Plans (⭐ Stars)",
                  callback_data: "vip_info",
                },
                {
                  text: "⬅️ Back",
                  callback_data: "menu_earn",
                },
              ],
            ],
          },
        }
      );
    } catch (err) {
      console.error("Referral display error:", err);
      await ctx.reply("❌ Failed to generate referral link.");
    }
  });

  // Buy points packages -> redirect to VIP Plans with Stars
  bot.action("earn_buy_points", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const { showVipMenu } = await import("@/lib/telegram/handlers/vip");
      await showVipMenu(ctx);
    } catch (err) {
      console.error("Package list error:", err);
      await ctx.reply("❌ Error loading VIP packages.");
    }
  });

  // Handle package purchase selection with official Telegram Stars invoice
  bot.action(/^pkg_buy_(.+)$/, async (ctx) => {
    try {
      try {
        await ctx.answerCbQuery();
      } catch {}

      const packageId = ctx.match[1];
      const telegramUserId = BigInt(ctx.from.id);

      const user = await prisma.user.findUnique({
        where: { telegramUserId },
        select: { id: true, pointsBalance: true },
      });

      if (!user) {
        await ctx.reply("❌ User profile not found. Please use /start.");
        return;
      }

      const pkg = await prisma.pointsPackage.findUnique({
        where: { id: packageId },
      });

      if (!pkg || !pkg.isActive) {
        await ctx.reply("❌ Package not found or inactive.");
        return;
      }

      // Create unique pending order record in database
      const order = await createPendingOrder({
        userId: user.id,
        orderType: "POINTS_PACKAGE",
        packageIdOrKey: pkg.id,
        paymentMethod: "TELEGRAM_STARS",
      });

      // Dispatch official Telegram Stars digital goods invoice
      await ctx.replyWithInvoice({
        title: `TalkBuddy ${pkg.name}`,
        description: `Top-up +${pkg.points} TalkBuddy Points to save partners, reconnect, and activate VIP.`,
        payload: order.orderPayload,
        provider_token: "", // Telegram Stars requires empty string
        currency: "XTR",
        prices: [{ label: pkg.name, amount: pkg.starsPrice }],
      });

      await ctx.reply(
        `⭐ <b>Invoice Sent Above</b>\n\n` +
          `📦 <b>Package:</b> ${pkg.name}\n` +
          `💎 <b>Points:</b> +${pkg.points} Points\n` +
          `💰 <b>Price:</b> ⭐ ${pkg.starsPrice} Stars (XTR)\n\n` +
          `Tap the <b>Pay ⭐${pkg.starsPrice}</b> button on the invoice above to complete your points recharge.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬅️ Back to Packages", callback_data: "earn_buy_points" }],
              [{ text: "🏠 Main Menu", callback_data: "back_main_menu" }],
            ],
          },
        }
      );
    } catch (err: any) {
      console.error("Package payment invoice error:", err);
      await ctx.reply(`❌ Could not generate invoice: ${err.message || "Please try again later."}`);
    }
  });
}
