import type { Telegraf } from "telegraf";
import {
  validatePreCheckoutQuery,
  fulfillSuccessfulPayment,
} from "@/lib/telegram/vip";

/**
 * Registers Telegraf handlers for Telegram Stars payments:
 * - pre_checkout_query: Validates pending order and approves checkout
 * - successful_payment: Fulfills order, activates VIP or credits Points, and sends receipt
 */
export function registerPaymentHandlers(bot: Telegraf) {
  // 1. Handle pre_checkout_query (Telegram requires response within 10 seconds)
  bot.on("pre_checkout_query", async (ctx) => {
    try {
      const query = ctx.preCheckoutQuery;
      console.log(
        `[Payment] Received pre_checkout_query from user ${ctx.from.id}: payload=${query.invoice_payload}, amount=${query.total_amount} ${query.currency}`
      );

      const validation = await validatePreCheckoutQuery(
        query.invoice_payload,
        query.total_amount,
        query.currency
      );

      if (validation.isValid) {
        console.log(`[Payment] pre_checkout_query approved for payload: ${query.invoice_payload}`);
        await ctx.answerPreCheckoutQuery(true);
      } else {
        console.warn(
          `[Payment] pre_checkout_query rejected: ${validation.errorMessage} (payload: ${query.invoice_payload})`
        );
        await ctx.answerPreCheckoutQuery(
          false,
          validation.errorMessage || "Payment validation failed. Please try again."
        );
      }
    } catch (err: any) {
      console.error("[Payment] Error handling pre_checkout_query:", err);
      try {
        await ctx.answerPreCheckoutQuery(
          false,
          "Unable to verify order at this time. Please retry."
        );
      } catch (replyErr) {
        console.error("[Payment] Failed to answer pre_checkout_query error:", replyErr);
      }
    }
  });

  // 2. Handle successful_payment (Official confirmation from Telegram Stars)
  bot.on("successful_payment", async (ctx) => {
    try {
      const payment = ctx.message.successful_payment;
      console.log(
        `[Payment] Received successful_payment from user ${ctx.from.id}: charge_id=${payment.telegram_payment_charge_id}, amount=${payment.total_amount} ${payment.currency}`
      );

      const result = await fulfillSuccessfulPayment({
        telegramUserId: ctx.from.id,
        telegramPaymentChargeId: payment.telegram_payment_charge_id,
        providerPaymentChargeId: payment.provider_payment_charge_id,
        orderPayload: payment.invoice_payload,
        totalAmountStars: payment.total_amount,
        currency: payment.currency,
      });

      const res = result as any;
      if (res.orderType === "VIP_SUBSCRIPTION") {
        const expiresFormatted = res.vipExpiresAt
          ? new Date(res.vipExpiresAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "Active";

        await ctx.reply(
          `🎉 <b>Payment Successful! VIP Activated!</b> 👑\n\n` +
            `🌟 <b>Unlocked Plan:</b> <b>${res.planLabel || "VIP Membership"}</b>\n` +
            `⭐ <b>Amount Paid:</b> <b>${payment.total_amount} Stars (XTR)</b>\n` +
            `📅 <b>VIP Expiration:</b> <b>${expiresFormatted}</b>\n` +
            `🧾 <b>Charge Reference:</b> <code>${payment.telegram_payment_charge_id}</code>\n\n` +
            `✨ <b>Your VIP Perks Are Now Active:</b>\n` +
            `• 💖 <b>Gender Filter:</b> Choose your preferred partner gender\n` +
            `• 🚀 <b>Priority Queue:</b> Match faster than free users\n` +
            `• 💬 <b>Unlimited Chats:</b> No limits or pauses\n` +
            `• 🗑️ <b>Message Wipe:</b> Erase messages with <code>/delete</code>\n\n` +
            `👇 <i>Tap below to set your Name, Gender, and partner matching preferences:</i>`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "🎯 Set Profile & Gender Filter", callback_data: "vip_onboard_start" },
                ],
                [
                  { text: "🔎 Find Partner", callback_data: "menu_find" },
                  { text: "📜 Purchase History", callback_data: "vip_history" },
                ],
                [
                  { text: "⬅️ Main Menu", callback_data: "back_main_menu" },
                ],
              ],
            },
          }
        );
      } else {
        await ctx.reply(
          `🎉 <b>Payment Successful! Points Credited!</b> 💰\n\n` +
            `⭐ <b>Amount Paid:</b> <b>${payment.total_amount} Stars (XTR)</b>\n` +
            `💎 <b>Points Credited:</b> <b>+${res.pointsAdded || 0} Points</b>\n` +
            `💰 <b>New Points Balance:</b> <b>${res.newBalance || "Updated"} Points</b>\n` +
            `🧾 <b>Charge Reference:</b> <code>${payment.telegram_payment_charge_id}</code>\n\n` +
            `You can now use your points to save partners, reconnect, and unlock VIP privileges!`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "💎 View VIP Plans", callback_data: "vip_info" },
                  { text: "🔎 Find Partner", callback_data: "menu_find" },
                ],
                [
                  { text: "📜 Purchase History", callback_data: "vip_history" },
                  { text: "⬅️ Main Menu", callback_data: "back_main_menu" },
                ],
              ],
            },
          }
        );
      }
    } catch (err: any) {
      console.error("[Payment] Critical error fulfilling successful_payment:", err);
      await ctx.reply(
        "⚠️ We received your payment, but an error occurred during membership activation.\n\n" +
          "Your transaction is securely recorded in our database. Please contact support with /paysupport to finalize your activation."
      );
    }
  });
}
