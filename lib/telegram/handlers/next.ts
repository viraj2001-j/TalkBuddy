// import type { Telegraf } from "telegraf";
// import prisma from "@/lib/db";
// import { savePreviousPartner } from "@/lib/telegram/previous-partners";

// import { findAndCreateMatch } from "@/lib/telegram/matching";
// import { getConnectedMessage,
//       showWaitingForPartner,
//  } from "@/lib/telegram/messages";

// export function registerNextHandler(bot: Telegraf) {
//   bot.command("next", async (ctx) => {
//   const telegramUserId = ctx.from.id;

//   try {
//     const user = await prisma.user.findUnique({
//       where: {
//         telegramUserId: BigInt(telegramUserId),
//       },
//       select: {
//         id: true,
//         gender: true,
//       },
//     });

//     if (!user?.gender) {
//       await ctx.reply(
//         "🔒 Please complete your profile first.\n\n" +
//           "Use /start."
//       );
//       return;
//     }

//     const currentQueue =
//       await prisma.matchingQueue.findUnique({
//         where: {
//           userId: user.id,
//         },
//         select: {
//           id: true,
//           status: true,
//           partnerUserId: true,
//         },
//       });

//     // ========================================
//     // END CURRENT CHAT
//     // ========================================

// if (
//   currentQueue?.status === "MATCHED" &&
//   currentQueue.partnerUserId
// ) {
//   const oldPartner = await prisma.user.findUnique({
//     where: {
//       id: currentQueue.partnerUserId,
//     },
//     select: {
//       id: true,
//       telegramUserId: true,
//     },
//   });

//   if (oldPartner) {

//       // Save previous partner relationship
//   await savePreviousPartner(user.id, oldPartner.id);

//     // Disconnect old partner
//     await prisma.matchingQueue.updateMany({
//       where: {
//         userId: oldPartner.id,
//         status: "MATCHED",
//       },
//       data: {
//         status: "ENDED",
//         partnerUserId: null,
//       },
//     });

//     // Notify old partner
//     try {
//       await ctx.telegram.sendMessage(
//         Number(oldPartner.telegramUserId),
//         "💔 <b>Chat Ended</b>\n\n" +
//           "Your partner found someone new.\n\n" +
//           "Use /start | /next to find another person.",
//         {
//           parse_mode: "HTML",
//         }
//       );
//     } catch (partnerError) {
//       console.error(
//         "Failed to notify old partner:",
//         partnerError
//       );
//     }

//     // ========================================
//     // END OLD CHAT SESSION
//     // ========================================

//     await prisma.chatSession.updateMany({
//       where: {
//         OR: [
//           {
//             userOneId: user.id,
//             userTwoId: oldPartner.id,
//           },
//           {
//             userOneId: oldPartner.id,
//             userTwoId: user.id,
//           },
//         ],
//         status: "ACTIVE",
//       },
//       data: {
//         status: "ENDED",
//         endedAt: new Date(),
//         endReason: "NEXT",
//       },
//     });
//   }
// }


//     // ========================================
//     // PUT CURRENT USER INTO WAITING
//     // ========================================

//     await prisma.matchingQueue.upsert({
//       where: {
//         userId: user.id,
//       },
//       update: {
//         status: "WAITING",
//         partnerUserId: null,
//         joinedAt: new Date(),
//       },
//       create: {
//         userId: user.id,
//         status: "WAITING",
//         partnerUserId: null,
//       },
//     });

//     // ========================================
//     // ATOMICALLY FIND NEW PARTNER
//     // ========================================

//     const match = await findAndCreateMatch(user.id);

//     // ========================================
//     // NEW MATCH FOUND
//     // ========================================

//     if (match) {
//       const newPartnerUser =
//         await prisma.user.findUnique({
//           where: {
//             id: match.partnerUserId,
//           },
//           select: {
//             telegramUserId: true,
//           },
//         });

//       // Notify new partner
//       if (newPartnerUser) {
//         try {
//           await ctx.telegram.sendMessage(
//             Number(newPartnerUser.telegramUserId),
//             getConnectedMessage(),
//             {
//               parse_mode: "HTML",
//             }
//           );
//         } catch (partnerError) {
//           console.error(
//             "Failed to send new connection message:",
//             partnerError
//           );
//         }
//       }

//       // Show connected message to current user
//       await ctx.reply(getConnectedMessage(), {
//         parse_mode: "HTML",
//       });

//       return;
//     }

//     // ========================================
//     // NO NEW PARTNER
//     // ========================================

//     // await ctx.reply(
//     //   "⏳ <b>Looking for another partner...</b>\n\n" +
//     //     "We're searching for someone new.\n\n" +
//     //     "Use /end to stop searching.",
//     //   {
//     //     parse_mode: "HTML",
//     //   }
//     // );

//     await showWaitingForPartner(ctx);

//   } catch (error) {
//     console.error("Failed to find next partner:", error);

//     await ctx.reply(
//       "❌ Could not find another partner.\n\n" +
//         "Please try again."
//     );
//   }
// });
//   }



// import type { Telegraf } from "telegraf";
// import prisma from "@/lib/db";

// import { savePreviousPartner } from "@/lib/telegram/previous-partners";

// import {
//   cancelPendingReconnectRequests,
// } from "@/lib/telegram/reconnect";

// import { findAndCreateMatch } from "@/lib/telegram/matching";

// import {
// getConnectedMessageWithVip,
//   showWaitingForPartner,
// } from "@/lib/telegram/messages";

// export function registerNextHandler(bot: Telegraf) {
//   bot.command("next", async (ctx) => {
//     const telegramUserId = ctx.from.id;

//     try {
//       // ==========================================
//       // FIND USER
//       // ==========================================

//       const user = await prisma.user.findUnique({
//         where: {
//           telegramUserId: BigInt(telegramUserId),
//         },
//         select: {
//           id: true,
//           gender: true,
//         },
//       });

//       if (!user?.gender) {
//         await ctx.reply(
//           "🔒 Please complete your profile first.\n\n" +
//             "Use /start."
//         );

//         return;
//       }

//       // ==========================================
//       // CANCEL PENDING RECONNECT REQUESTS
//       // ==========================================

//       const cancelledRequests =
//         await cancelPendingReconnectRequests(
//           user.id
//         );

//       // Notify the other side of every cancelled
//       // reconnect request.
//       for (const request of cancelledRequests) {
//         const otherUserId =
//           request.senderId === user.id
//             ? request.receiverId
//             : request.senderId;

//         const otherUser =
//           await prisma.user.findUnique({
//             where: {
//               id: otherUserId,
//             },
//             select: {
//               telegramUserId: true,
//             },
//           });

//         if (otherUser) {
//           try {
//             await ctx.telegram.sendMessage(
//               Number(otherUser.telegramUserId),
//               "❌ <b>Reconnect Request Cancelled</b>\n\n" +
//                 "The reconnect request was cancelled because the other user started a new chat.\n\n" +
//                 "Use /start or /next to find someone new.",
//               {
//                 parse_mode: "HTML",
//               }
//             );
//           } catch (notifyError) {
//             console.error(
//               "Failed to notify reconnect cancellation:",
//               notifyError
//             );
//           }
//         }
//       }

//       // ==========================================
//       // CHECK CURRENT QUEUE
//       // ==========================================

//       const currentQueue =
//         await prisma.matchingQueue.findUnique({
//           where: {
//             userId: user.id,
//           },
//           select: {
//             status: true,
//             partnerUserId: true,
//           },
//         });

//       // ==========================================
//       // END CURRENT CHAT
//       //
//       // /next means:
//       // "Leave current partner and find another."
//       // ==========================================

//       if (
//         currentQueue?.status === "MATCHED" &&
//         currentQueue.partnerUserId
//       ) {
//         const oldPartner =
//           await prisma.user.findUnique({
//             where: {
//               id: currentQueue.partnerUserId,
//             },
//             select: {
//               id: true,
//               telegramUserId: true,
//             },
//           });

//         if (oldPartner) {
//           // Preserve previous-partner history.
//           await savePreviousPartner(
//             user.id,
//             oldPartner.id
//           );

//           // End old partner's queue entry.
//           await prisma.matchingQueue.updateMany({
//             where: {
//               userId: oldPartner.id,
//               status: "MATCHED",
//             },
//             data: {
//               status: "ENDED",
//               partnerUserId: null,
//             },
//           });

//           // End active chat session.
//           await prisma.chatSession.updateMany({
//             where: {
//               OR: [
//                 {
//                   userOneId: user.id,
//                   userTwoId: oldPartner.id,
//                 },
//                 {
//                   userOneId: oldPartner.id,
//                   userTwoId: user.id,
//                 },
//               ],
//               status: "ACTIVE",
//             },
//             data: {
//               status: "ENDED",
//               endedAt: new Date(),
//               endReason: "NEXT",
//             },
//           });

//           // Notify old partner.
//           try {
//             await ctx.telegram.sendMessage(
//               Number(oldPartner.telegramUserId),
//               "💔 <b>Chat Ended</b>\n\n" +
//                 "Your partner found someone new.\n\n" +
//                 "Use /start or /next to find another person.",
//               {
//                 parse_mode: "HTML",
//               }
//             );
//           } catch (partnerError) {
//             console.error(
//               "Failed to notify old partner:",
//               partnerError
//             );
//           }
//         }
//       }

//       // ==========================================
//       // START FRESH SEARCH
//       // ==========================================

//       await prisma.matchingQueue.upsert({
//         where: {
//           userId: user.id,
//         },
//         update: {
//           status: "WAITING",
//           partnerUserId: null,
//           joinedAt: new Date(),
//         },
//         create: {
//           userId: user.id,
//           status: "WAITING",
//           partnerUserId: null,
//         },
//       });

//       // ==========================================
//       // FIND NEW PARTNER
//       // ==========================================

//       const match = await findAndCreateMatch(
//         user.id
//       );

//       // ==========================================
//       // MATCH FOUND
//       // ==========================================

//       if (match) {
//         const newPartnerUser =
//           await prisma.user.findUnique({
//             where: {
//               id: match.partnerUserId,
//             },
//             select: {
//               telegramUserId: true,
//             },
//           });

//         if (newPartnerUser) {
//           try {
//             await ctx.telegram.sendMessage(
//               Number(
//                 newPartnerUser.telegramUserId
//               ),
//               getConnectedMessage(),
//               {
//                 parse_mode: "HTML",
//               }
//             );
//           } catch (partnerError) {
//             console.error(
//               "Failed to send new connection message:",
//               partnerError
//             );
//           }
//         }

//         await ctx.reply(
//           getConnectedMessage(),
//           {
//             parse_mode: "HTML",
//           }
//         );

//         return;
//       }

//       // ==========================================
//       // NO MATCH
//       //
//       // /next DOES show Reconnect + Save.
//       // ==========================================

//       await showWaitingForPartner(ctx);
//     } catch (error) {
//       console.error(
//         "Failed to find next partner:",
//         error
//       );

//       await ctx.reply(
//         "❌ Could not find another partner.\n\n" +
//           "Please try again."
//       );
//     }
//   });
// }


import type { Telegraf } from "telegraf";
import prisma from "@/lib/db";

import { savePreviousPartner } from "@/lib/telegram/previous-partners";

import {
  cancelPendingReconnectRequests,
} from "@/lib/telegram/reconnect";

import { findAndCreateMatch } from "@/lib/telegram/matching";

import {
  getConnectedMessageWithVip,
  showWaitingForPartner,
} from "@/lib/telegram/messages";

import { clearSavePartnerState } from "@/lib/telegram/saved-partners";

export async function handleNext(ctx: any) {
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
        gender: true,
      },
    });

    if (user) {
      await clearSavePartnerState(user.id);
    }

    if (!user?.gender) {
      await ctx.reply(
        "🔒 Please complete your profile first.\n\n" +
          "Use /start."
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
              "The reconnect request was cancelled because the other user started a new chat.\n\n" +
              "Use /start or /search to find someone new.",
            { parse_mode: "HTML" }
          );
        } catch (notifyError) {
          console.error("Failed to notify reconnect cancellation:", notifyError);
        }
      }
    }

    // ==========================================
    // CHECK CURRENT QUEUE
    // ==========================================
    const currentQueue = await prisma.matchingQueue.findUnique({
      where: { userId: user.id },
      select: {
        status: true,
        partnerUserId: true,
      },
    });

    // ==========================================
    // END CURRENT CHAT
    // ==========================================
    if (
      currentQueue?.status === "MATCHED" &&
      currentQueue.partnerUserId
    ) {
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
            endReason: "NEXT",
          },
        });

        try {
          await ctx.telegram.sendMessage(
            Number(oldPartner.telegramUserId),
            "💔 <b>Chat Ended</b>\n\n" +
              "Your partner left to find someone new.\n\n" +
              "Use /search or /next to find another partner.",
            { parse_mode: "HTML" }
          );
        } catch (partnerError) {
          console.error("Failed to notify old partner:", partnerError);
        }
      }
    }

    // ==========================================
    // START FRESH SEARCH
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
    // FIND NEW PARTNER
    // ==========================================
    const match = await findAndCreateMatch(user.id);

    if (match) {
      const newPartnerUser = await prisma.user.findUnique({
        where: { id: match.partnerUserId },
        select: { telegramUserId: true },
      });

      const connectedMessage = getConnectedMessageWithVip();

      if (newPartnerUser) {
        try {
          await ctx.telegram.sendMessage(
            Number(newPartnerUser.telegramUserId),
            connectedMessage.text,
            {
              parse_mode: "HTML",
              reply_markup: connectedMessage.reply_markup,
            }
          );
        } catch (partnerError) {
          console.error("Failed to send new connection message:", partnerError);
        }
      }

      await ctx.reply(connectedMessage.text, {
        parse_mode: "HTML",
        reply_markup: connectedMessage.reply_markup,
      });

      return;
    }

    // ==========================================
    // NO MATCH YET
    // ==========================================
    await showWaitingForPartner(ctx);
  } catch (error) {
    console.error("Failed to find next partner in handleNext:", error);
    await ctx.reply("❌ Could not find another partner. Please try again.");
  }
}

export function registerNextHandler(bot: Telegraf) {
  bot.command("next", handleNext);
}