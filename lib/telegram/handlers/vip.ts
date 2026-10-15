import type { Telegraf } from "telegraf";
import prisma from "@/lib/db";
import { getVipMessage } from "@/lib/telegram/messages";
import { getVipKeyboard } from "@/lib/telegram/menu";
import {
  getUserVipStatus,
  purchaseVipWithPoints,
  createPendingOrder,
  getVipPackageByKey,
  VIP_PLANS,
  type VipPlan,
  type VipPlanKey,
} from "@/lib/telegram/vip";

/**
 * Generates the preview message and keyboard when selecting a VIP package.
 * Displays package duration, description, Stars price, and Points price,
 * allowing the user to choose their preferred checkout method.
 */
export function renderVipPackageCheck(plan: VipPlan, pointsBalance: number) {
  const isPointsSufficient = pointsBalance >= plan.pointsCost;
  const remainingAfter = pointsBalance - plan.pointsCost;

  let text: string;
  if (isPointsSufficient) {
    text =
      `👑 <b>VIP Package Activation: ${plan.label}</b>\n\n` +
      `📋 <b>Plan Description:</b> ${plan.description}\n` +
      `⏳ <b>Duration:</b> ${plan.durationDays} Days\n` +
      `💰 <b>Package Price:</b> <b>${plan.pointsCost} Telegram Points</b> (or ⭐ ${plan.starsPrice} Stars)\n\n` +
      `💎 <b>Your Telegram Points:</b> <b>${pointsBalance} Points</b>\n` +
      `✨ <b>Balance After Activation:</b> <b>${remainingAfter} Points</b>\n\n` +
      `✅ <b>You have enough Telegram Points to activate this package!</b>\n\n` +
      `👇 <b>Choose your payment method:</b>`;
  } else {
    const missingPoints = plan.pointsCost - pointsBalance;
    text =
      `❌ <b>Telegram Points Not Enough!</b>\n\n` +
      `👑 <b>Package:</b> ${plan.label} VIP (${plan.durationDays} Days)\n` +
      `📋 <b>Plan Description:</b> ${plan.description}\n` +
      `💰 <b>Required Points:</b> <b>${plan.pointsCost} Telegram Points</b>\n\n` +
      `💎 <b>Your Telegram Points:</b> <b>${pointsBalance} Points</b>\n` +
      `⚠️ <b>Missing:</b> <b>${missingPoints} Telegram Points</b>\n\n` +
      `💡 <i>You can pay instantly with ⭐ ${plan.starsPrice} Stars (XTR) or top up points below:</i>`;
  }

  const inline_keyboard: any[][] = [
    [
      {
        text: `⭐ Pay with Stars (⭐${plan.starsPrice} Stars)`,
        callback_data: `vip_stars_${plan.key}`,
      },
    ],
  ];

  if (isPointsSufficient) {
    inline_keyboard.push([
      {
        text: `💎 Pay with Points (${plan.pointsCost} pts)`,
        callback_data: `vip_confirm_${plan.key}`,
      },
    ]);
  } else {
    inline_keyboard.push([
      {
        text: `💳 Buy Points (${plan.pointsCost} pts needed)`,
        callback_data: "earn_buy_points",
      },
      {
        text: "🎁 Daily Bonus",
        callback_data: "earn_daily",
      },
    ]);
  }

  inline_keyboard.push([
    {
      text: "⬅️ Back to VIP Plans",
      callback_data: "vip_info",
    },
  ]);

  return { text, reply_markup: { inline_keyboard }, isSufficient: isPointsSufficient };
}

/**
 * Generates the celebratory activation message when VIP purchase succeeds.
 */
export function renderVipActivatedMessage(
  result: {
    plan: VipPlan;
    pointsBalance: number;
    vipExpiresAt: Date | null;
  },
  isProfileComplete: boolean = true
) {
  const expiresFormatted = result.vipExpiresAt
    ? new Date(result.vipExpiresAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Active";

  if (!isProfileComplete) {
    const text =
      `🎉 <b>VIP Membership Activated!</b> 👑\n\n` +
      `🌟 <b>Unlocked Plan:</b> <b>${result.plan.label}</b>\n` +
      `📅 <b>Valid Until:</b> <b>${expiresFormatted}</b>\n` +
      `💎 <b>Remaining Points:</b> <b>${result.pointsBalance} Points</b>\n\n` +
      `🎯 <b>Setup Your Profile & Gender Filter:</b>\n` +
      `To unlock your <b>VIP Gender Filter</b>, take a few seconds to confirm your Name, Age (optional), Gender, and Location (optional).\n\n` +
      `👇 <i>Tap below to begin quick profile setup & pick your gender filter:</i>`;

    const reply_markup = {
      inline_keyboard: [
        [
          {
            text: "🎯 Set Profile & Gender Filter",
            callback_data: "vip_onboard_start",
          },
        ],
        [
          {
            text: "🔎 Find Someone (Standard)",
            callback_data: "menu_find",
          },
        ],
        [
          {
            text: "⬅️ Main Menu",
            callback_data: "back_main_menu",
          },
        ],
      ],
    };

    return { text, reply_markup };
  }

  const text =
    `🎉 <b>VIP Membership Activated!</b> 👑\n\n` +
    `🌟 <b>Unlocked Plan:</b> <b>${result.plan.label}</b>\n` +
    `📅 <b>Valid Until:</b> <b>${expiresFormatted}</b>\n` +
    `💎 <b>Remaining Points:</b> <b>${result.pointsBalance} Points</b>\n\n` +
    `✨ <b>Your VIP Perks Are Now Active:</b>\n` +
    `• 💖 <b>Gender Filter:</b> Unlocked! Customize your preferred partner gender\n` +
    `• 🚀 <b>Priority Queue:</b> Skip the wait and match faster\n` +
    `• 💬 <b>Unlimited Chats:</b> No conversation limits\n` +
    `• 🗑️ <b>Message Wipe:</b> Erase messages with <code>/delete</code>\n\n` +
    `👇 <i>Tap below to select who you want to match with:</i>`;

  const reply_markup = {
    inline_keyboard: [
      [
        {
          text: "🎯 Choose Gender Filter",
          callback_data: "vip_filter_select",
        },
      ],
      [
        {
          text: "🔎 Find Partner Now",
          callback_data: "menu_find",
        },
        {
          text: "📜 Purchase History",
          callback_data: "vip_history",
        },
      ],
      [
        {
          text: "⬅️ Main Menu",
          callback_data: "back_main_menu",
        },
      ],
    ],
  };

  return { text, reply_markup };
}

/**
 * Safely finds or auto-registers a user from the Telegram context.
 */
export async function getOrCreateTelegramUser(ctx: any) {
  const rawTgId = ctx.from?.id;
  if (!rawTgId) return null;

  const telegramUserId = BigInt(rawTgId);
  return await prisma.user.upsert({
    where: { telegramUserId },
    update: {
      username: ctx.from?.username ?? null,
      firstName: ctx.from?.first_name || "User",
      lastName: ctx.from?.last_name ?? null,
    },
    create: {
      telegramUserId,
      username: ctx.from?.username ?? null,
      firstName: ctx.from?.first_name || "User",
      lastName: ctx.from?.last_name ?? null,
      referralCode: `TB${rawTgId}`,
      gender: "",
      pointsBalance: 100, // 100 welcome points by default
      isVip: false,
    },
  });
}

/**
 * Displays the main VIP overview screen.
 */
export async function showVipMenu(ctx: any) {
  try {
    const user = await getOrCreateTelegramUser(ctx);
    if (!user) {
      console.warn("showVipMenu invoked without user in context");
      return;
    }

    let status = {
      pointsBalance: user.pointsBalance,
      isVip: user.isVip,
      vipExpiresAt: user.vipExpiresAt,
    };

    try {
      const vipStatus = await getUserVipStatus(user.id);
      if (vipStatus) {
        status = {
          pointsBalance: vipStatus.pointsBalance ?? user.pointsBalance,
          isVip: vipStatus.isVip ?? user.isVip,
          vipExpiresAt: vipStatus.vipExpiresAt ?? user.vipExpiresAt,
        };
      }
    } catch (statusErr) {
      console.warn("Fallback to user record in showVipMenu:", statusErr);
    }

    const text = getVipMessage(
      status.pointsBalance,
      status.isVip,
      status.vipExpiresAt
    );

    const reply_markup = getVipKeyboard(Boolean(status.isVip));

    if (ctx.callbackQuery) {
      try {
        await ctx.answerCbQuery().catch(() => {});
      } catch {}

      try {
        await ctx.editMessageText(text, {
          parse_mode: "HTML",
          reply_markup,
        });
      } catch (editErr: any) {
        const msg = editErr?.message || String(editErr);
        if (msg.includes("message is not modified")) {
          return;
        }
        await ctx.reply(text, {
          parse_mode: "HTML",
          reply_markup,
        });
      }
    } else {
      await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup,
      });
    }
  } catch (error) {
    console.error("Failed to show VIP:", error);
    try {
      await ctx.reply("❌ Could not open VIP information. Please try again.");
    } catch (replyErr) {
      console.error("Failed to send fallback VIP error message:", replyErr);
    }
  }
}

/**
 * Handles package selection: shows description, Stars price, and Points price.
 */
export async function handleVipPackageSelect(ctx: any, planKey: VipPlanKey) {
  try {
    try {
      await ctx.answerCbQuery().catch(() => {});
    } catch {}

    const plan = await getVipPackageByKey(planKey);
    if (!plan) {
      await ctx.reply("❌ Invalid VIP package selected.");
      return;
    }

    const user = await getOrCreateTelegramUser(ctx);
    if (!user) return;

    let pointsBalance = user.pointsBalance;
    try {
      const vipStatus = await getUserVipStatus(user.id);
      if (vipStatus?.pointsBalance !== undefined) {
        pointsBalance = vipStatus.pointsBalance;
      }
    } catch {}

    const { text, reply_markup } = renderVipPackageCheck(
      plan,
      pointsBalance
    );

    try {
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup,
      });
    } catch (editErr: any) {
      const msg = editErr?.message || String(editErr);
      if (msg.includes("message is not modified")) {
        return;
      }
      await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup,
      });
    }
  } catch (err) {
    console.error("VIP package select error:", err);
    await ctx.reply("❌ Failed to load VIP package details. Please try again.");
  }
}

/**
 * Dispatches official Telegram Stars invoice for purchasing VIP.
 */
export async function handleVipStarsInvoice(ctx: any, planKey: VipPlanKey) {
  try {
    try {
      await ctx.answerCbQuery().catch(() => {});
    } catch {}

    const plan = await getVipPackageByKey(planKey);
    if (!plan) {
      await ctx.reply("❌ Invalid VIP package selected.");
      return;
    }

    const user = await getOrCreateTelegramUser(ctx);
    if (!user) {
      await ctx.reply("❌ Profile not found. Please use /start.");
      return;
    }

    // Create unique pending order in database
    const order = await createPendingOrder({
      userId: user.id,
      orderType: "VIP_SUBSCRIPTION",
      packageIdOrKey: plan.key,
      paymentMethod: "TELEGRAM_STARS",
    });

    // Dispatch official Telegram Stars digital goods invoice
    await ctx.replyWithInvoice({
      title: `TalkBuddy ${plan.label}`,
      description: `${plan.durationDays} Days VIP: Unlock Gender filter, Priority matching & Unlimited chats.`,
      payload: order.orderPayload,
      provider_token: "", // Empty string required for Telegram Stars (XTR)
      currency: "XTR",
      prices: [{ label: plan.label, amount: plan.starsPrice }],
    });

    await ctx.reply(
      `⭐ <b>Invoice Sent Above</b>\n\n` +
        `Tap the <b>Pay ⭐${plan.starsPrice}</b> button on the invoice to complete your purchase using Telegram Stars.\n\n` +
        `Your VIP membership will be activated instantly upon payment confirmation.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "⬅️ Back to VIP Plans", callback_data: "vip_info" }],
          ],
        },
      }
    );
  } catch (err: any) {
    console.error("Failed to dispatch Stars invoice:", err);
    await ctx.reply(`❌ Could not generate invoice: ${err.message || "Please try again later."}`);
  }
}

/**
 * Handles VIP package activation with Points.
 */
export async function handleVipConfirmActivation(ctx: any, planKey: VipPlanKey) {
  try {
    try {
      await ctx.answerCbQuery().catch(() => {});
    } catch {}

    const plan = await getVipPackageByKey(planKey);
    if (!plan) {
      await ctx.reply("❌ Invalid VIP package.");
      return;
    }

    const user = await getOrCreateTelegramUser(ctx);
    if (!user) {
      await ctx.reply("❌ User profile not found. Please use /start first.");
      return;
    }

    const result = await purchaseVipWithPoints(user.id, planKey);

    if (result.success) {
      const isComplete = Boolean(
        user.isProfileComplete ||
          (user.gender && user.country && user.age && user.age >= 18)
      );

      const { text, reply_markup } = renderVipActivatedMessage(result, isComplete);
      try {
        await ctx.editMessageText(text, {
          parse_mode: "HTML",
          reply_markup,
        });
      } catch (editErr: any) {
        const msg = editErr?.message || String(editErr);
        if (msg.includes("message is not modified")) return;
        await ctx.reply(text, {
          parse_mode: "HTML",
          reply_markup,
        });
      }
    } else if (result.reason === "INSUFFICIENT_FUNDS") {
      const { text, reply_markup } = renderVipPackageCheck(
        plan,
        result.pointsBalance ?? user.pointsBalance
      );
      try {
        await ctx.editMessageText(text, {
          parse_mode: "HTML",
          reply_markup,
        });
      } catch (editErr: any) {
        const msg = editErr?.message || String(editErr);
        if (msg.includes("message is not modified")) return;
        await ctx.reply(text, {
          parse_mode: "HTML",
          reply_markup,
        });
      }
    } else {
      await ctx.reply("❌ Could not process VIP activation. Please try again.");
    }
  } catch (err) {
    console.error("VIP confirm activation error:", err);
    await ctx.reply("❌ Failed to activate VIP. Please try again.");
  }
}

/**
 * Shows user's complete historical purchase records and active memberships.
 */
export async function showUserPurchaseHistory(ctx: any) {
  try {
    try {
      await ctx.answerCbQuery().catch(() => {});
    } catch {}

    const rawTgId = ctx.from?.id;
    if (!rawTgId) return;

    const telegramUserId = BigInt(rawTgId);
    const user = await prisma.user.findUnique({
      where: { telegramUserId },
      include: {
        paymentTransactions: {
          orderBy: { createdAt: "desc" },
          take: 15,
          include: {
            vipPackage: true,
            package: true,
            vipSubscription: true,
          },
        },
      },
    });

    if (!user) {
      await ctx.reply("❌ User profile not found. Please use /start.");
      return;
    }

    const transactions = user.paymentTransactions || [];

    let currentPoints = user.pointsBalance;
    let isVipActive = user.isVip;
    try {
      const vipStatus = await getUserVipStatus(user.id);
      if (vipStatus) {
        currentPoints = vipStatus.pointsBalance ?? user.pointsBalance;
        isVipActive = vipStatus.isVip ?? user.isVip;
      }
    } catch {}

    const vipLabel = isVipActive ? "Active" : "Free Plan";

    if (transactions.length === 0) {
      const emptyText =
        `📜 <b>Your Purchase & Payment History</b>\n\n` +
        `💎 <b>Current Points Balance:</b> <b>${currentPoints} Points</b>\n` +
        `👑 <b>VIP Status:</b> ${vipLabel}\n\n` +
        `<i>You haven't made any purchases yet.</i>\n` +
        `Choose an option below to buy VIP or recharge points:`;

      const emptyKeyboard = {
        inline_keyboard: [
          [
            { text: "💎 View VIP Plans", callback_data: "vip_info" },
            { text: "💳 Buy Points", callback_data: "earn_buy_points" },
          ],
          [{ text: "⬅️ Back to Menu", callback_data: "back_main_menu" }],
        ],
      };

      if (ctx.callbackQuery) {
        try {
          await ctx.editMessageText(emptyText, {
            parse_mode: "HTML",
            reply_markup: emptyKeyboard,
          });
        } catch (editErr: any) {
          const msg = editErr?.message || String(editErr);
          if (msg.includes("message is not modified")) return;
          await ctx.reply(emptyText, {
            parse_mode: "HTML",
            reply_markup: emptyKeyboard,
          });
        }
      } else {
        await ctx.reply(emptyText, {
          parse_mode: "HTML",
          reply_markup: emptyKeyboard,
        });
      }
      return;
    }

    let historyLines = transactions
      .map((t, idx) => {
        const dateStr = new Date(t.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        const statusIcon =
          t.status === "COMPLETED"
            ? "✅"
            : t.status === "REFUNDED"
            ? "↩️"
            : t.status === "PENDING"
            ? "⏳"
            : "❌";

        const currencyLabel =
          t.currency === "XTR"
            ? `⭐ ${t.starsAmount ?? t.amountPaid} Stars`
            : t.currency === "POINTS"
            ? `💎 ${t.pointsAmount} pts`
            : `$${t.amountPaid} ${t.currency}`;

        const itemName =
          t.vipPackage?.name ||
          t.package?.name ||
          (t.orderType === "VIP_SUBSCRIPTION" ? "VIP Membership" : "Points Top-up");

        let line = `${idx + 1}. ${statusIcon} <b>${itemName}</b>\n`;
        line += `   💰 <b>Amount:</b> ${currencyLabel} | <b>Status:</b> ${t.status}\n`;
        line += `   📅 <b>Date:</b> ${dateStr}\n`;
        if (t.telegramPaymentChargeId) {
          line += `   🧾 <b>Charge ID:</b> <code>${t.telegramPaymentChargeId.substring(0, 16)}...</code>\n`;
        }
        if (t.vipSubscription?.expiresAt) {
          const expStr = new Date(t.vipSubscription.expiresAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          line += `   ⏳ <b>Expires:</b> ${expStr}\n`;
        }
        return line;
      })
      .join("\n");

    const message =
      `📜 <b>Your Purchase & Payment History</b>\n\n` +
      `💎 <b>Current Points Balance:</b> <b>${currentPoints} Points</b>\n` +
      `👑 <b>VIP Status:</b> ${vipLabel}\n\n` +
      historyLines +
      `\n<i>Displaying up to 15 recent transactions.</i>`;

    const reply_markup = {
      inline_keyboard: [
        [
          { text: "💎 View VIP Plans", callback_data: "vip_info" },
          { text: "💳 Buy Points", callback_data: "earn_buy_points" },
        ],
        [{ text: "⬅️ Back to Menu", callback_data: "back_main_menu" }],
      ],
    };

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: "HTML",
        reply_markup,
      });
    } else {
      await ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup,
      });
    }
  } catch (err) {
    console.error("Failed to show purchase history:", err);
    await ctx.reply("❌ Could not load purchase history. Please try again.");
  }
}

/**
 * Registers Telegraf handlers for VIP actions.
 */
export function registerVipHandler(bot: Telegraf) {
  bot.command("vip", showVipMenu);
  bot.command("premium", showVipMenu);
  bot.command("history", showUserPurchaseHistory);

  bot.action("vip_info", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch {}
    await showVipMenu(ctx);
  });

  bot.action("vip_history", async (ctx) => {
    await showUserPurchaseHistory(ctx);
  });

  bot.action(/^vip_(buy|select)_(.+)$/, async (ctx) => {
    const planKey = ctx.match[2] as VipPlanKey;
    await handleVipPackageSelect(ctx, planKey);
  });

  bot.action(/^vip_stars_(.+)$/, async (ctx) => {
    const planKey = ctx.match[1] as VipPlanKey;
    await handleVipStarsInvoice(ctx, planKey);
  });

  bot.action(/^vip_confirm_(.+)$/, async (ctx) => {
    const planKey = ctx.match[1] as VipPlanKey;
    await handleVipConfirmActivation(ctx, planKey);
  });
}