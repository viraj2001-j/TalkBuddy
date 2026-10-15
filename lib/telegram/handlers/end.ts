// import type { Telegraf } from "telegraf";
// import prisma from "@/lib/db";
// import { savePreviousPartner } from "@/lib/telegram/previous-partners";

// export function registerEndHandler(bot: Telegraf) {
//   bot.command("end", async (ctx) => {
//       const telegramUserId = ctx.from.id;

//   try {
//     const user = await prisma.user.findUnique({
//       where: {
//         telegramUserId: BigInt(telegramUserId),
//       },
//       select: {
//         id: true,
//       },
//     });

//     if (!user) {
//       await ctx.reply(
//         "❌ Your profile was not found.\n\n" +
//           "Please use /start."
//       );
//       return;
//     }

//     const queueEntry = await prisma.matchingQueue.findUnique({
//       where: {
//         userId: user.id,
//       },
//       select: {
//         id: true,
//         status: true,
//         partnerUserId: true,
//       },
//     });

//     if (!queueEntry) {
//       await ctx.reply(
//         "🏠 You're not currently searching or chatting.\n\n" +
//           "Use /start | /next to find someone."
//       );
//       return;
//     }

//     let partnerTelegramUserId: bigint | null = null;
//     let partnerId: string | null = null;

//     // ========================================
//     // FIND CURRENT PARTNER
//     // ========================================

//     if (
//       queueEntry.status === "MATCHED" &&
//       queueEntry.partnerUserId
//     ) {
//       const partner = await prisma.user.findUnique({
//         where: {
//           id: queueEntry.partnerUserId,
//         },
//         select: {
//           id: true,
//           telegramUserId: true,
//         },
//       });

//       if (partner) {
//         partnerId = partner.id;
//         partnerTelegramUserId = partner.telegramUserId;
//       }
//     }

//     // ========================================
//     // END PARTNER
//     // ========================================

//     if (partnerId) {

//          await savePreviousPartner(user.id, partnerId);

//       await prisma.matchingQueue.updateMany({
//         where: {
//           userId: partnerId,
//         },
//         data: {
//           status: "ENDED",
//           partnerUserId: null,
//         },
//       });
//     }

//     // ========================================
//     // END CURRENT USER
//     // ========================================

//     await prisma.matchingQueue.update({
//       where: {
//         userId: user.id,
//       },
//       data: {
//         status: "ENDED",
//         partnerUserId: null,
//       },
//     });

//     // ========================================
// // END CHAT SESSION
// // ========================================

// if (partnerId) {
//   await prisma.chatSession.updateMany({
//     where: {
//       OR: [
//         {
//           userOneId: user.id,
//           userTwoId: partnerId,
//         },
//         {
//           userOneId: partnerId,
//           userTwoId: user.id,
//         },
//       ],
//       status: "ACTIVE",
//     },
//     data: {
//       status: "ENDED",
//       endedAt: new Date(),
//       endReason: "USER_ENDED",
//     },
//   });
// }
//     // ========================================
//     // NOTIFY PARTNER
//     // ========================================

//     if (partnerTelegramUserId) {
//       try {
//         await ctx.telegram.sendMessage(
//           Number(partnerTelegramUserId),
//           "💔 <b>Chat Ended</b>\n\n" +
//             "Your partner has ended the chat.\n\n" +
//             "Use /start | /next to find someone new.",
//           {
//             parse_mode: "HTML",
//           }
//         );
//       } catch (partnerError) {
//         console.error(
//           "Failed to notify partner:",
//           partnerError
//         );
//       }
//     }

//     // ========================================
//     // CONFIRM CURRENT USER
//     // ========================================

//     await ctx.reply(
//       "🛑 <b>Chat ended.</b>\n\n" +
//         "Thanks for using TalkBuddy!\n\n" +
//         "Use /start | /next to find someone new.",
//       {
//         parse_mode: "HTML",
//       }
//     );
//   } catch (error) {
//     console.error("Failed to end chat:", error);

//     await ctx.reply(
//       "❌ Could not end the chat.\n\n" +
//         "Please try again."
//     );
//   }
// });
// }



import type { Telegraf } from "telegraf";
import prisma from "@/lib/db";

import { savePreviousPartner } from "@/lib/telegram/previous-partners";

import {
  cancelPendingReconnectRequests,
} from "@/lib/telegram/reconnect";

import { clearSavePartnerState } from "@/lib/telegram/saved-partners";
import { rewardChatCompletion } from "@/lib/telegram/points";

export async function handleEnd(ctx: any) {
  const telegramUserId = ctx.from?.id;
  if (!telegramUserId) return;

  try {
    // ==========================================
    // FIND USER
    // ==========================================
    const user = await prisma.user.findUnique({
      where: {
        telegramUserId: BigInt(telegramUserId),
      },
      select: {
        id: true,
      },
    });

    if (user) {
      await clearSavePartnerState(user.id);
    }

    if (!user) {
      await ctx.reply(
        "❌ Your profile was not found.\n\n" +
          "Please use /start to set up your profile."
      );
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
              "The reconnect request was cancelled because the user ended their session.\n\n" +
              "Use /search or /start to find someone new.",
            { parse_mode: "HTML" }
          );
        } catch (notifyError) {
          console.error("Failed to notify reconnect cancellation:", notifyError);
        }
      }
    }

    // ==========================================
    // FIND CURRENT QUEUE ENTRY
    // ==========================================
    const queueEntry = await prisma.matchingQueue.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        status: true,
        partnerUserId: true,
      },
    });

    // ==========================================
    // NOTHING ACTIVE / IDLE
    // ==========================================
    if (!queueEntry || queueEntry.status === "ENDED") {
      await ctx.reply(
        "🏠 <b>You're not currently searching or chatting.</b>\n\n" +
          "Use /search or tap below to find a partner!",
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔎 Find Someone", callback_data: "menu_find" }],
              [{ text: "⬅️ Main Menu", callback_data: "back_main_menu" }],
            ],
          },
        }
      );
      return;
    }

    // ==========================================
    // WAITING IN QUEUE -> CANCEL SEARCH
    // ==========================================
    if (queueEntry.status === "WAITING") {
      await prisma.matchingQueue.update({
        where: { userId: user.id },
        data: { status: "ENDED", partnerUserId: null },
      });

      await ctx.reply(
        "🛑 <b>Search stopped.</b>\n\n" +
          "You have left the matching queue.\n\n" +
          "Use /search when you are ready to find a partner!",
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔎 Find Someone", callback_data: "menu_find" }],
              [{ text: "⬅️ Main Menu", callback_data: "back_main_menu" }],
            ],
          },
        }
      );
      return;
    }

    let userReward: number | undefined;

    // ==========================================
    // END ACTIVE CHAT SESSION
    // ==========================================
    if (queueEntry.status === "MATCHED" && queueEntry.partnerUserId) {
      const partner = await prisma.user.findUnique({
        where: { id: queueEntry.partnerUserId },
        select: { id: true, telegramUserId: true },
      });

      if (partner) {
        // Preserve previous partner relationship
        await savePreviousPartner(user.id, partner.id);

        // End partner queue
        await prisma.matchingQueue.updateMany({
          where: { userId: partner.id, status: "MATCHED" },
          data: { status: "ENDED", partnerUserId: null },
        });

        // End active chat session
        await prisma.chatSession.updateMany({
          where: {
            OR: [
              { userOneId: user.id, userTwoId: partner.id },
              { userOneId: partner.id, userTwoId: user.id },
            ],
            status: "ACTIVE",
          },
          data: {
            status: "ENDED",
            endedAt: new Date(),
            endReason: "USER_STOPPED",
          },
        });

        // Reward points for conversation
        userReward = await rewardChatCompletion(user.id);
        const partnerReward = await rewardChatCompletion(partner.id);

        const partnerRewardText =
          typeof partnerReward === "number"
            ? `🎁 <b>+5 Points Earned!</b> Balance: <b>${partnerReward} Points</b>\n\n`
            : "";

        // Notify partner
        try {
          await ctx.telegram.sendMessage(
            Number(partner.telegramUserId),
            "💔 <b>Chat Ended</b>\n\n" +
              partnerRewardText +
              "Your partner has ended the chat.\n\n" +
              "Use /search or /start to find someone new.",
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "🔄 Reconnect", callback_data: "reconnect_previous" },
                    { text: "💾 Save Partner", callback_data: "save_previous" },
                  ],
                  [
                    { text: "🔎 Find Someone", callback_data: "menu_find" },
                    { text: "👑 VIP", callback_data: "vip_info" },
                  ],
                ],
              },
            }
          );
        } catch (partnerError) {
          console.error("Failed to notify partner of chat end:", partnerError);
        }
      }
    }

    // End current user's queue
    await prisma.matchingQueue.update({
      where: { userId: user.id },
      data: { status: "ENDED", partnerUserId: null },
    });

    let currentBalanceText = "";
    if (typeof userReward === "number") {
      currentBalanceText = `🎁 <b>+5 Points Earned!</b> Current balance: <b>${userReward} Points</b>\n\n`;
    } else {
      try {
        const freshUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { pointsBalance: true },
        });
        if (freshUser) {
          currentBalanceText = `💎 <b>Current balance:</b> <b>${freshUser.pointsBalance} Points</b>\n\n`;
        }
      } catch {}
    }

    // Final response to user
    await ctx.reply(
      "🛑 <b>Chat ended.</b>\n\n" +
        currentBalanceText +
        "Thanks for using TalkBuddy!\n\n" +
        "You can reconnect with your previous partner or find someone new.",
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 Reconnect previous user", callback_data: "reconnect_previous" },
              { text: "💾 Save previous user", callback_data: "save_previous" },
            ],
            [
              { text: "🔎 Find Someone", callback_data: "menu_find" },
              { text: "👑 VIP", callback_data: "vip_info" },
            ],
            [
              { text: "⬅️ Main Menu", callback_data: "back_main_menu" },
            ],
          ],
        },
      }
    );
  } catch (error) {
    console.error("Failed to end chat in handleEnd:", error);
    await ctx.reply("❌ Could not end the chat. Please try again.");
  }
}

export function registerEndHandler(bot: Telegraf) {
  bot.command("end", handleEnd);
  bot.command("stop", handleEnd);
  bot.action("btn_stop_chat", async (ctx) => {
    try { await ctx.answerCbQuery(); } catch {}
    await handleEnd(ctx);
  });
}