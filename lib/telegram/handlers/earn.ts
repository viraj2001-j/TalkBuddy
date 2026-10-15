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
    const currentPoints = vipInfo.pointsBalance ?? user.pointsBalance;
    const message =
      `💰 <b>TalkBuddy Points & Earning Center</b>\n\n` +
      `👤 <b>User:</b> ${user.firstName}\n` +
      `💎 <b>Current Balance:</b> <b>${currentPoints} Points</b>\n` +
      `👑 <b>VIP Status:</b> ${
        vipInfo.isVip
          ? `Active (Expires: ${
              vipInfo.vipExpiresAt
                ? new Date(vipInfo.vipExpiresAt).toLocaleDateString()
                : "Active"
            })`
          : "Free Plan"
      }\n\n` +
      `✨ <b>Ways to Earn & Use Points:</b>\n` +
      `• 🎁 <b>Daily Bonus:</b> +25 pts every 24 hours\n` +
      `• 👥 <b>Invite Friends:</b> +50 pts per referral\n` +
      `• 💬 <b>Chat Activity:</b> +5 pts for conversations\n` +
      `• 💾 <b>Save Partners:</b> 10 pts per saved contact\n` +
      `• 👑 <b>VIP Access:</b> Unlock with 80+ pts\n\n` +
      `Choose an action below:`;

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
        `👥 <b>Invite Friends & Earn Points</b>\n\n` +
          `Share your personal referral link with friends. When they join, you earn <b>+50 Points</b> and they get <b>+25 Points</b>!\n\n` +
          `🔗 <b>Your Invite Link:</b>\n<code>${referralLink}</code>\n\n` +
          `📊 <b>Your Referrals:</b> ${referralCount} friends joined\n` +
          `💎 <b>Points Earned from Referrals:</b> ${referralCount * 50} pts\n\n` +
          `Tap the link above to copy it or forward it to groups!`,
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
                  text: "⬅️ Back to Earning Menu",
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

  // Buy points packages
  bot.action("earn_buy_points", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const packages = await prisma.pointsPackage.findMany({
        where: { isActive: true },
        orderBy: { points: "asc" },
      });

      if (packages.length === 0) {
        await ctx.editMessageText(
          "💳 No payment packages available right now. Please check back later.",
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "⬅️ Back", callback_data: "menu_earn" }],
              ],
            },
          }
        );
        return;
      }

      const inlineButtons = packages.map((pkg) => [
        {
          text: `⚡ ${pkg.name}: +${pkg.points} pts ($${pkg.priceUsd} / ⭐${pkg.starsPrice})`,
          callback_data: `pkg_buy_${pkg.id}`,
        },
      ]);

      inlineButtons.push([
        { text: "⬅️ Back to Earning Menu", callback_data: "menu_earn" },
      ]);

      await ctx.editMessageText(
        `💳 <b>Buy Points Packages</b>\n\n` +
          `Get instant Points to save unlimited partners, reconnect anytime, and upgrade to VIP access.\n\n` +
          `Select a package below to proceed:`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: inlineButtons,
          },
        }
      );
    } catch (err) {
      console.error("Package list error:", err);
      await ctx.reply("❌ Error loading packages.");
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
