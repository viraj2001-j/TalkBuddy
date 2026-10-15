import { Context } from "telegraf";

import {
  getGenderKeyboard,
  getMainMenuKeyboard,
  getWaitingPartnerKeyboard,
  getConnectedKeyboard,
} from "@/lib/telegram/menu";

export function getConnectedMessage() {
  return (
    "<b>🐧 Chat Connected!</b> · <a href=\"https://t.me/TalkBuddyGlobalBot?start=vip\">💎 View VIP</a>\n\n" +
    "<b>Partner:</b> 🔒 Hidden\n\n" +
    "<i>Say hello to start the conversation...</i>\n\n" +
    "/next — Find another | /end — Stop chat"
  );
}

export function getConnectedMessageWithVip() {
  return {
    text:
      "<b>🐧 Chat Connected!</b>\n\n" +
      "<b>Partner:</b> 🔒 Hidden\n\n" +
      "<i>Say hello to start the conversation...</i>\n\n" +
      "/next — Find another | /end — Stop chat",
    reply_markup: getConnectedKeyboard(),
  };
}

export function getVipMessage(
  pointsBalance: number = 0,
  isVip: boolean = false,
  vipExpiresAt?: Date | null
) {
  let statusText = "<b>👑 VIP Status: Free Plan</b>\n\n";

  if (isVip) {
    if (vipExpiresAt) {
      const expiresFormatted = new Date(vipExpiresAt).toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" }
      );
      statusText = `<b>👑 VIP Status: ACTIVE</b> (Expires: ${expiresFormatted})\n\n`;
    } else {
      statusText = `<b>👑 VIP Status: ACTIVE</b> (Permanent / Uncapped)\n\n`;
    }
  }

  return (
    `🎀 <b>TalkBuddy VIP Membership</b> 🎀\n\n` +
    statusText +
    `💎 <b>Your Telegram Points:</b> <b>${pointsBalance} Points</b>\n\n` +
    `✨ <b>Exclusive VIP Perks:</b>\n` +
    `💖 <b>Gender Filter:</b> Pick exactly who you want to match with!\n` +
    `🚀 <b>Priority Queue:</b> Skip the wait and match instantly.\n` +
    `💬 <b>Unlimited Chats:</b> No more daily limits.\n` +
    `🗑️ <b>Message Wipe:</b> Use <code>/delete</code> to erase messages for both of you!\n\n` +
    `👇 <i>Select a VIP package below to check your points and activate:</i>`
  );
}

export async function showGenderSelection(ctx: Context) {
  await ctx.reply(
    "👋 Welcome to TalkBuddy!\n\n" +
      "🌍 Meet someone. Talk anonymously. Make a connection.\n\n" +
      "Before you continue, please select your gender.\n\n" +
      "🔒 Your gender is required to use TalkBuddy.",
    {
      reply_markup: getGenderKeyboard(),
    }
  );
}

import prisma from "@/lib/db";
import { getUserVipStatus } from "@/lib/telegram/vip";

export async function showMainMenu(ctx: any) {
  let pointsInfo = "";
  let isVipUser = false;
  try {
    const rawId = ctx.from?.id;
    if (rawId) {
      const user = await prisma.user.findUnique({
        where: { telegramUserId: BigInt(rawId) },
        select: { id: true, pointsBalance: true, isVip: true, vipExpiresAt: true },
      });
      if (user) {
        let points = user.pointsBalance;
        let isVip = user.isVip;
        try {
          const vip = await getUserVipStatus(user.id);
          if (vip) {
            points = vip.pointsBalance ?? points;
            isVip = vip.isVip ?? isVip;
          }
        } catch {}

        isVipUser = Boolean(isVip);
        pointsInfo =
          `💎 <b>Telegram Points:</b> <b>${points} Points</b>\n` +
          `👑 <b>VIP Status:</b> <b>${isVip ? "Active" : "Free Plan"}</b>\n\n`;
      }
    }
  } catch {}

  const text =
    "🌍 <b>TalkBuddy Main Menu</b>\n\n" +
    pointsInfo +
    "Meet someone. Talk anonymously. Make connections & earn rewards.\n\n" +
    "What would you like to do?";

  const reply_markup = getMainMenuKeyboard(isVipUser);

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup,
      });
      return;
    } catch (err: any) {
      if (err?.message?.includes("message is not modified")) return;
    }
  }

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup,
  });
}

export async function showWaitingForPartner(ctx: Context) {
  await ctx.reply(
    "⏳ <b>Waiting for a partner..</b>\n\n" +
      "We're looking for someone for you.\n\n" +
      "Use /end to stop searching.",
    {
      parse_mode: "HTML",
      reply_markup: getWaitingPartnerKeyboard(),
    }
  );
}