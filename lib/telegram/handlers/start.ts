// // import type { Telegraf } from "telegraf";
// // import prisma from "@/lib/db";
// // import { getMainMenuKeyboard } from "@/lib/telegram/menu";
// // import { showGenderSelection } from "@/lib/telegram/messages";

// // export function registerStartHandler(bot: Telegraf) {
// //   bot.command("start", async (ctx) => {
// //     const telegramUserId = ctx.from.id;

// //     try {
// //       const existingUser = await prisma.user.findUnique({
// //         where: {
// //           telegramUserId: BigInt(telegramUserId),
// //         },
// //       });

// //       if (existingUser?.gender) {
// //         await ctx.reply(
// //           "👋 Welcome back!\n\n" +
// //             "Your TalkBuddy profile is already set up.",
// //           {
// //             reply_markup: getMainMenuKeyboard(),
// //           }
// //         );

// //         return;
// //       }

// //       await showGenderSelection(ctx);
// //     } catch (error) {
// //       console.error("Failed to check user:", error);

// //       await ctx.reply(
// //         "❌ Something went wrong while checking your profile.\n\n" +
// //           "Please try again."
// //       );
// //     }
// //   });
// // }


// import type { Telegraf } from "telegraf";
// import prisma from "@/lib/db";
// import { getMainMenuKeyboard } from "@/lib/telegram/menu";
// import { showGenderSelection } from "@/lib/telegram/messages";

// export function registerStartHandler(bot: Telegraf) {
//   bot.command("start", async (ctx) => {
//     const telegramUserId = ctx.from.id;

//     try {
//       const existingUser = await prisma.user.findUnique({
//         where: {
//           telegramUserId: BigInt(telegramUserId),
//         },
//       });

//       // ========================================
//       // /start MUST NOT SHOW RECONNECT/SAVE
//       // ========================================

//       if (existingUser?.gender) {
//         await ctx.reply(
//           "👋 Welcome back!\n\n" +
//             "Your TalkBuddy profile is already set up.",
//           {
//             reply_markup: getMainMenuKeyboard(),
//           }
//         );

//         return;
//       }

//       await showGenderSelection(ctx);
//     } catch (error) {
//       console.error("Failed to check user:", error);

//       await ctx.reply(
//         "❌ Something went wrong while checking your profile.\n\n" +
//           "Please try again."
//       );
//     }
//   });
// }

import type { Telegraf } from "telegraf";
import prisma from "@/lib/db";

import {
  showGenderSelection,
  getConnectedMessageWithVip,
} from "@/lib/telegram/messages";

import { getWaitingPartnerKeyboard } from "@/lib/telegram/menu";

import { findAndCreateMatch } from "@/lib/telegram/matching";

import {
  cancelPendingReconnectRequests,
} from "@/lib/telegram/reconnect";

import { savePreviousPartner } from "@/lib/telegram/previous-partners";
import { clearSavePartnerState } from "@/lib/telegram/saved-partners";
import { processReferral } from "@/lib/telegram/points";

export async function handleStart(ctx: any) {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return;

  try {
    // ==========================================
    // FIND OR CREATE USER PROFILE
    // ==========================================
    const user = await prisma.user.upsert({
      where: {
        telegramUserId: BigInt(telegramUserId),
      },
      update: {
        username: ctx.from.username ?? null,
        firstName: ctx.from.first_name || "User",
        lastName: ctx.from.last_name ?? null,
      },
      create: {
        telegramUserId: BigInt(telegramUserId),
        username: ctx.from.username ?? null,
        firstName: ctx.from.first_name || "User",
        lastName: ctx.from.last_name ?? null,
        referralCode: `TB${telegramUserId}`,
        gender: "",
      },
      select: {
        id: true,
        gender: true,
      },
    });

    await clearSavePartnerState(user.id);

    // ==========================================
    // PROCESS REFERRAL CODE IF PRESENT
    // ==========================================
    const payload =
      (ctx as any).payload ||
      (ctx.message && "text" in ctx.message ? ctx.message.text.split(" ")[1] : "") ||
      "";

    if (payload.startsWith("ref_")) {
      const refCode = payload.replace("ref_", "").trim();
      const refResult = await processReferral(user.id, refCode).catch(console.error);
      if (refResult && refResult.success) {
        await ctx.reply(
          "🎁 <b>Welcome to TalkBuddy!</b>\n\n" +
            "You joined via an invite link. Enjoy chatting anonymously with new people around the world!",
          { parse_mode: "HTML" }
        );
      }
    }

    // ==========================================
    // DEEP-LINK: VIP MENU (/start vip)
    // ==========================================
    if (payload.toLowerCase() === "vip") {
      const { showVipMenu } = await import("@/lib/telegram/handlers/vip");
      await showVipMenu(ctx);
      return;
    }

    // ==========================================
    // NEW USER / NO GENDER
    // ==========================================
    if (!user.gender) {
      await showGenderSelection(ctx);
      return;
    }

    // ==========================================
    // CANCEL PENDING RECONNECT REQUESTS
    // ==========================================
    const cancelledRequests = await cancelPendingReconnectRequests(user.id);

    for (const request of cancelledRequests) {
      const otherUserId =
        request.senderId === user.id
          ? request.receiverId
          : request.senderId;

      const otherUser = await prisma.user.findUnique({
        where: { id: otherUserId },
        select: { telegramUserId: true },
      });

      if (otherUser) {
        try {
          await ctx.telegram.sendMessage(
            Number(otherUser.telegramUserId),
            "❌ <b>Reconnect Request Cancelled</b>\n\n" +
              "The reconnect request was cancelled because the other user started a new session.\n\n" +
              "Use /start or /search to find someone new.",
            { parse_mode: "HTML" }
          );
        } catch (notifyError) {
          console.error("Failed to notify reconnect cancellation:", notifyError);
        }
      }
    }

    // ==========================================
    // CHECK CURRENT MATCHING STATE
    // ==========================================
    const currentQueue = await prisma.matchingQueue.findUnique({
      where: { userId: user.id },
      select: { status: true, partnerUserId: true },
    });

    // If currently matched, end current conversation gracefully
    if (currentQueue?.status === "MATCHED" && currentQueue.partnerUserId) {
      const oldPartner = await prisma.user.findUnique({
        where: { id: currentQueue.partnerUserId },
        select: { id: true, telegramUserId: true },
      });

      if (oldPartner) {
        await savePreviousPartner(user.id, oldPartner.id);

        await prisma.matchingQueue.updateMany({
          where: { userId: oldPartner.id, status: "MATCHED" },
          data: { status: "ENDED", partnerUserId: null },
        });

        await prisma.chatSession.updateMany({
          where: {
            OR: [
              { userOneId: user.id, userTwoId: oldPartner.id },
              { userOneId: oldPartner.id, userTwoId: user.id },
            ],
            status: "ACTIVE",
          },
          data: {
            status: "ENDED",
            endedAt: new Date(),
            endReason: "USER_ENDED",
          },
        });

        try {
          await ctx.telegram.sendMessage(
            Number(oldPartner.telegramUserId),
            "💔 <b>Chat Ended</b>\n\n" +
              "Your partner started a fresh TalkBuddy session.\n\n" +
              "Use /start or /search to find someone new.",
            { parse_mode: "HTML" }
          );
        } catch (partnerError) {
          console.error("Failed to notify old partner:", partnerError);
        }
      }
    }

    // ==========================================
    // FRESH MATCHING SESSION
    // ==========================================
    await prisma.matchingQueue.upsert({
      where: { userId: user.id },
      update: {
        status: "WAITING",
        partnerUserId: null,
        joinedAt: new Date(),
      },
      create: {
        userId: user.id,
        status: "WAITING",
        partnerUserId: null,
      },
    });

    // ==========================================
    // TRY TO FIND NEW PARTNER
    // ==========================================
    const match = await findAndCreateMatch(user.id);

    if (match) {
      const partner = await prisma.user.findUnique({
        where: { id: match.partnerUserId },
        select: { telegramUserId: true },
      });

      const connectedMessage = getConnectedMessageWithVip();

      if (partner) {
        try {
          await ctx.telegram.sendMessage(
            Number(partner.telegramUserId),
            connectedMessage.text,
            {
              parse_mode: "HTML",
              reply_markup: connectedMessage.reply_markup,
            }
          );
        } catch (partnerError) {
          console.error("Failed to notify new partner:", partnerError);
        }
      }

      await ctx.reply(connectedMessage.text, {
        parse_mode: "HTML",
        reply_markup: connectedMessage.reply_markup,
      });

      return;
    }

    // ==========================================
    // NO IMMEDIATE MATCH -> WAITING
    // ==========================================
    await ctx.reply(
      "⏳ <b>Waiting for a partner..</b>\n\n" +
        "We're looking for someone for you.\n\n" +
        "Use /stop to cancel searching.",
      {
        parse_mode: "HTML",
        reply_markup: getWaitingPartnerKeyboard(),
      }
    );
  } catch (error) {
    console.error("Failed to start TalkBuddy in handleStart:", error);
    await ctx.reply("❌ Something went wrong while starting TalkBuddy. Please try again.");
  }
}

export function registerStartHandler(bot: Telegraf) {
  bot.command("start", handleStart);
}