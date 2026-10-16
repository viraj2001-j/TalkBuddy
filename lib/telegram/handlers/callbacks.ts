// import type { Telegraf } from "telegraf";
// import prisma from "@/lib/db";
// import {
//   createReconnectRequest,
//     acceptReconnectRequest,
//   declineReconnectRequest,
// } from "@/lib/telegram/reconnect";

// import {
//   getPreviousPartner,
//   getPreviousPartnerId,
// } from "@/lib/telegram/previous-partners";
// import {
//   getGenderKeyboard,
//   getMainMenuKeyboard,
// } from "@/lib/telegram/menu";

// import {
//   getConnectedMessage,
//   showMainMenu,
//     showWaitingForPartner,
// } from "@/lib/telegram/messages";

// import { findAndCreateMatch } from "@/lib/telegram/matching";

// export function registerCallbackHandlers(bot: Telegraf) {
//   bot.on("callback_query", async (ctx) => {
//   const telegramUserId = ctx.from.id;

//   if (!("data" in ctx.callbackQuery)) {
//     await ctx.answerCbQuery();
//     return;
//   }

//   const data = ctx.callbackQuery.data;

//   // ==========================================
//   // GENDER
//   // ==========================================

//   if (data.startsWith("gender_")) {
//     let gender = "";

//     switch (data) {
//       case "gender_male":
//         gender = "Male";
//         break;

//       case "gender_female":
//         gender = "Female";
//         break;

//       case "gender_trans_man":
//         gender = "Trans Man";
//         break;

//       case "gender_trans_woman":
//         gender = "Trans Woman";
//         break;

//       case "gender_non_binary":
//         gender = "Non-binary";
//         break;

//       default:
//         await ctx.answerCbQuery("Invalid gender selection.");
//         return;
//     }

//     try {
//       await prisma.user.upsert({
//         where: {
//           telegramUserId: BigInt(telegramUserId),
//         },

//         update: {
//           username: ctx.from.username ?? null,
//           firstName: ctx.from.first_name,
//           lastName: ctx.from.last_name ?? null,
//           languageCode: ctx.from.language_code ?? null,
//           isTelegramPremium: ctx.from.is_premium ?? false,
//           gender,
//         },

//         create: {
//           telegramUserId: BigInt(telegramUserId),
//           username: ctx.from.username ?? null,
//           firstName: ctx.from.first_name,
//           lastName: ctx.from.last_name ?? null,
//           languageCode: ctx.from.language_code ?? null,
//           isTelegramPremium: ctx.from.is_premium ?? false,
//           gender,
//         },
//       });

//       await ctx.answerCbQuery("Profile saved");

//       await ctx.editMessageText(
//         "✅ Profile setup complete!\n\n" +
//           `👤 Gender: ${gender}\n\n` +
//           "🔒 Your Telegram identity will not be automatically shared with your chat partner.\n\n" +
//           "You can now find someone to talk to anonymously."
//       );

//       await showMainMenu(ctx);
//     } catch (error) {
//       console.error("Failed to save profile:", error);

//       await ctx.answerCbQuery("Failed to save profile.");

//       await ctx.editMessageText(
//         "❌ We couldn't save your profile.\n\n" +
//           "Please try again."
//       );
//     }

//     return;
//   }

//   // ==========================================
//   // FIND SOMEONE
//   // ==========================================

//   if (data === "menu_find") {
//     await ctx.answerCbQuery();

//     try {
//       const user = await prisma.user.findUnique({
//         where: {
//           telegramUserId: BigInt(telegramUserId),
//         },
//         select: {
//           gender: true,
//         },
//       });

//       if (!user?.gender) {
//         await ctx.editMessageText(
//           "🔒 Complete your profile first.\n\n" +
//             "You need to select your gender before you can find someone.",
//           {
//             reply_markup: {
//               inline_keyboard: [
//                 [
//                   {
//                     text: "👤 Select Gender",
//                     callback_data: "select_gender",
//                   },
//                 ],
//                 [
//                   {
//                     text: "⬅️ Back",
//                     callback_data: "back_main_menu",
//                   },
//                 ],
//               ],
//             },
//           }
//         );

//         return;
//       }

//       await ctx.editMessageText(
//         "🔎 Find Someone\n\n" +
//           "Ready to meet someone anonymously?",
//         {
//           reply_markup: {
//             inline_keyboard: [
//               [
//                 {
//                   text: "🔎 Start Searching",
//                   callback_data: "find_start",
//                 },
//               ],
//               [
//                 {
//                   text: "⬅️ Back to Menu",
//                   callback_data: "back_main_menu",
//                 },
//               ],
//             ],
//           },
//         }
//       );
//     } catch (error) {
//       console.error("Failed to check profile:", error);

//       await ctx.editMessageText(
//         "❌ Could not check your profile.\n\n" +
//           "Please try again."
//       );
//     }

//     return;
//   }

//   // ==========================================
//   // SELECT GENDER
//   // ==========================================

//   if (data === "select_gender") {
//     await ctx.answerCbQuery();

//     await ctx.editMessageText(
//       "👤 Choose your gender\n\n" +
//         "You need to select one option to continue.",
//       {
//         reply_markup: getGenderKeyboard(),
//       }
//     );

//     return;
//   }

//   // ==========================================
//   // MY PROFILE
//   // ==========================================

//   if (data === "menu_profile") {
//     await ctx.answerCbQuery();

//     try {
//       const user = await prisma.user.findUnique({
//         where: {
//           telegramUserId: BigInt(telegramUserId),
//         },
//       });

//       if (!user) {
//         await ctx.editMessageText(
//           "👤 My Profile\n\n" +
//             "⚠️ Your profile has not been created yet.",
//           {
//             reply_markup: {
//               inline_keyboard: [
//                 [
//                   {
//                     text: "👤 Select Gender",
//                     callback_data: "select_gender",
//                   },
//                 ],
//                 [
//                   {
//                     text: "⬅️ Back",
//                     callback_data: "back_main_menu",
//                   },
//                 ],
//               ],
//             },
//           }
//         );

//         return;
//       }

//       await ctx.editMessageText(
//         "👤 My Profile\n\n" +
//           `👤 Gender: ${user.gender}\n\n` +
//           `👤 Username: ${
//             user.username ? `@${user.username}` : "Not set"
//           }\n` +
//           `🌐 Language: ${
//             user.languageCode ?? "Not available"
//           }\n\n` +
//           "🔒 Your Telegram identity is not automatically shared with your chat partner.",
//         {
//           reply_markup: {
//             inline_keyboard: [
//               [
//                 {
//                   text: "⬅️ Back to Menu",
//                   callback_data: "back_main_menu",
//                 },
//               ],
//             ],
//           },
//         }
//       );
//     } catch (error) {
//       console.error("Failed to load profile:", error);

//       await ctx.editMessageText(
//         "❌ Could not load your profile.\n\n" +
//           "Please try again.",
//         {
//           reply_markup: {
//             inline_keyboard: [
//               [
//                 {
//                   text: "⬅️ Back to Menu",
//                   callback_data: "back_main_menu",
//                 },
//               ],
//             ],
//           },
//         }
//       );
//     }

//     return;
//   }

//   // ==========================================
//   // SAFETY
//   // ==========================================

//   if (data === "menu_safety") {
//     await ctx.answerCbQuery();

//     await ctx.editMessageText(
//       "🛡️ Safety & Privacy\n\n" +
//         "TalkBuddy is designed for anonymous conversations.\n\n" +
//         "🔒 Your Telegram identity is not automatically shared with your chat partner.\n\n" +
//         "🚫 Blocking and reporting will be added later.",
//       {
//         reply_markup: {
//           inline_keyboard: [
//             [
//               {
//                 text: "⬅️ Back to Menu",
//                 callback_data: "back_main_menu",
//               },
//             ],
//           ],
//         },
//       }
//     );

//     return;
//   }

//   // ==========================================
//   // START SEARCHING
//   // ==========================================

//   if (data === "find_start") {
//     await ctx.answerCbQuery();

//     try {
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
//         await ctx.editMessageText(
//           "🔒 You must select your gender before searching."
//         );

//         return;
//       }

//       // ========================================
//       // CHECK CURRENT STATE
//       // ========================================

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

//       // Already connected
//       if (currentQueue?.status === "MATCHED") {
//         await ctx.editMessageText(getConnectedMessage(), {
//           parse_mode: "HTML",
//         });

//         return;
//       }

//       // Already waiting
//     //   if (currentQueue?.status === "WAITING") {
//     //     await ctx.editMessageText(
//     //       "⏳ <b>Waiting for a partner...</b>\n\n" +
//     //         "We're looking for someone for you.\n\n" +
//     //         "Use /end to stop searching.",
//     //       {
//     //         parse_mode: "HTML",
//     //       }
//     //     );

//     //     return;
//     //   }


//     // Already waiting
// if (currentQueue?.status === "WAITING") {
//   await ctx.editMessageText(
//     "⏳ <b>Waiting for a partner..</b>\n\n" +
//         "We're looking for someone for you.\n\n" +
//             "Use /end to stop searching.",
//     {
//       parse_mode: "HTML",
//       reply_markup: {
//         inline_keyboard: [
//           [
//             {
//               text: "🔄 Reconnect previous user",
//               callback_data: "reconnect_previous",
//             },
//           ],
//           [
//             {
//               text: "💾 Save previous user",
//               callback_data: "save_previous",
//             },
//           ],
//         ],
//       },
//     }
//   );

//   return;
// }

//       // ========================================
//       // PUT USER INTO WAITING QUEUE
//       // ========================================

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

//       // ========================================
//       // ATOMICALLY FIND PARTNER
//       // ========================================

//       const match = await findAndCreateMatch(user.id);

//       // ========================================
//       // MATCH FOUND
//       // ========================================

//       if (match) {
//         const partner = await prisma.user.findUnique({
//           where: {
//             id: match.partnerUserId,
//           },
//           select: {
//             telegramUserId: true,
//           },
//         });

//         // Notify partner
//         if (partner) {
//           try {
//             await ctx.telegram.sendMessage(
//               Number(partner.telegramUserId),
//               getConnectedMessage(),
//               {
//                 parse_mode: "HTML",
//               }
//             );
//           } catch (partnerError) {
//             console.error(
//               "Failed to send connection message to partner:",
//               partnerError
//             );
//           }
//         }

//         // Show connected message to current user
//         await ctx.editMessageText(
//           getConnectedMessage(),
//           {
//             parse_mode: "HTML",
//           }
//         );

//         return;
//       }

//       // ========================================
//       // NO MATCH
//       // ========================================

//     //   await ctx.editMessageText(
//     //     "⏳ <b>Waiting for a partner...</b>\n\n" +
//     //       "We're looking for someone for you.\n\n" +
//     //       "Use /end to stop searching.",
//     //     {
//     //       parse_mode: "HTML",
//     //     }
//     //   );

//     // ========================================
// // NO MATCH
// // ========================================

// await ctx.editMessageText(
//   "⏳ <b>Waiting for a partner..</b>\n\n" +
//          "We're looking for someone for you.\n\n" +
//          "Use /end to stop searching.",
//   {
//     parse_mode: "HTML",
//     reply_markup: {
//       inline_keyboard: [
//         [
//           {
//             text: "🔄 Reconnect previous user",
//             callback_data: "reconnect_previous",
//           },
//         ],
//         [
//           {
//             text: "💾 Save previous user",
//             callback_data: "save_previous",
//           },
//         ],
//       ],
//     },
//   }
// );
//     } catch (error) {
//       console.error("Failed to start searching:", error);

//       await ctx.editMessageText(
//         "❌ Could not start searching.\n\n" +
//           "Please try again."
//       );
//     }

//     return;
//   }

//   // ==========================================
//   // BACK TO MAIN MENU
//   // ==========================================

//   if (data === "back_main_menu") {
//     await ctx.answerCbQuery();

//     await ctx.editMessageText(
//       "🏠 TalkBuddy\n\n" +
//         "What would you like to do?",
//       {
//         reply_markup: getMainMenuKeyboard(),
//       }
//     );

//     return;
//   }

//   // ==========================================
// // RECONNECT PREVIOUS USER
// // ==========================================

// if (data === "reconnect_previous") {
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
//       await ctx.answerCbQuery("Profile not found.");
//       return;
//     }

//     const previousPartner = await getPreviousPartner(user.id);

//     if (!previousPartner) {
//       await ctx.answerCbQuery(
//         "You don't have a previous partner yet."
//       );
//       return;
//     }

//     const previousPartnerId = getPreviousPartnerId(
//       previousPartner,
//       user.id
//     );

//     if (!previousPartnerId) {
//       await ctx.answerCbQuery(
//         "Previous partner not found."
//       );
//       return;
//     }

//     const request = await createReconnectRequest(
//       user.id,
//       previousPartnerId
//     );

//     if (!request) {
//       await ctx.answerCbQuery(
//         "Reconnect request could not be created."
//       );
//       return;
//     }

//     const receiver = await prisma.user.findUnique({
//       where: {
//         id: previousPartnerId,
//       },
//       select: {
//         telegramUserId: true,
//       },
//     });

//     if (!receiver) {
//       await ctx.answerCbQuery(
//         "Previous partner is no longer available."
//       );
//       return;
//     }

//     await ctx.telegram.sendMessage(
//       Number(receiver.telegramUserId),
//       "🔄 <b>Reconnect Request</b>\n\n" +
//         "Your previous partner wants to reconnect.",
//       {
//         parse_mode: "HTML",
//         reply_markup: {
//           inline_keyboard: [
//             [
//               {
//                 text: "✅ Accept",
//                 callback_data: `reconnect_accept_${request.id}`,
//               },
//               {
//                 text: "❌ Decline",
//                 callback_data: `reconnect_decline_${request.id}`,
//               },
//             ],
//           ],
//         },
//       }
//     );

//     await ctx.reply(
//       "📨 <b>Reconnect request sent</b>\n\n" +
//         "Waiting for your previous partner to respond.",
//       {
//         parse_mode: "HTML",
//       }
//     );

//     await ctx.answerCbQuery();
//     return;
//   } catch (error) {
//     console.error(
//       "Failed to create reconnect request:",
//       error
//     );

//     await ctx.answerCbQuery(
//       "Could not send reconnect request."
//     );
//     return;
//   }
// }

// // ==========================================
// // ACCEPT RECONNECT REQUEST
// // ==========================================

// if (data.startsWith("reconnect_accept_")) {
//   const requestId = data.replace(
//     "reconnect_accept_",
//     ""
//   );

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
//       await ctx.answerCbQuery("Profile not found.");
//       return;
//     }

//     const result = await acceptReconnectRequest(
//       requestId,
//       user.id
//     );

//     if (!result) {
//       await ctx.answerCbQuery(
//         "This reconnect request is no longer available."
//       );

//       await ctx.reply(
//         "❌ <b>Reconnect request expired.</b>\n\n" +
//           "The request is no longer available.",
//         {
//           parse_mode: "HTML",
//         }
//       );

//       return;
//     }

//     const sender = await prisma.user.findUnique({
//       where: {
//         id: result.senderId,
//       },
//       select: {
//         telegramUserId: true,
//       },
//     });

//     if (!sender) {
//       await ctx.answerCbQuery(
//         "Sender is no longer available."
//       );
//       return;
//     }

//     // Update the request message so it cannot be clicked again.
//     try {
//       await ctx.editMessageReplyMarkup({
//         inline_keyboard: [],
//       });
//     } catch (error) {
//       console.error(
//         "Failed to remove reconnect buttons:",
//         error
//       );
//     }

//     // Notify sender.
//     try {
//       await ctx.telegram.sendMessage(
//         Number(sender.telegramUserId),
//         getConnectedMessage(),
//         {
//           parse_mode: "HTML",
//         }
//       );
//     } catch (partnerError) {
//       console.error(
//         "Failed to notify reconnect sender:",
//         partnerError
//       );
//     }

//     // Show connected message to receiver.
//     await ctx.reply(
//       getConnectedMessage(),
//       {
//         parse_mode: "HTML",
//       }
//     );

//     await ctx.answerCbQuery(
//       "Reconnected successfully!"
//     );

//     return;
//   } catch (error) {
//     console.error(
//       "Failed to accept reconnect request:",
//       error
//     );

//     await ctx.answerCbQuery(
//       "Could not accept reconnect request."
//     );

//     return;
//   }
// }

// // ==========================================
// // DECLINE RECONNECT REQUEST
// // ==========================================

// if (data.startsWith("reconnect_decline_")) {
//   const requestId = data.replace(
//     "reconnect_decline_",
//     ""
//   );

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
//       await ctx.answerCbQuery("Profile not found.");
//       return;
//     }

//     const request =
//       await prisma.reconnectRequest.findUnique({
//         where: {
//           id: requestId,
//         },
//         select: {
//           id: true,
//           senderId: true,
//           receiverId: true,
//           status: true,
//         },
//       });

//     if (!request) {
//       await ctx.answerCbQuery(
//         "Reconnect request not found."
//       );
//       return;
//     }

//     if (request.receiverId !== user.id) {
//       await ctx.answerCbQuery(
//         "This request is not for you."
//       );
//       return;
//     }

//     if (request.status !== "PENDING") {
//       await ctx.answerCbQuery(
//         "This request is no longer pending."
//       );
//       return;
//     }

//     const result = await declineReconnectRequest(
//       requestId,
//       user.id
//     );

//     if (result.count === 0) {
//       await ctx.answerCbQuery(
//         "This request is no longer available."
//       );
//       return;
//     }

//     // Remove buttons from receiver's request.
//     try {
//       await ctx.editMessageReplyMarkup({
//         inline_keyboard: [],
//       });
//     } catch (error) {
//       console.error(
//         "Failed to remove reconnect buttons:",
//         error
//       );
//     }

//     const sender = await prisma.user.findUnique({
//       where: {
//         id: request.senderId,
//       },
//       select: {
//         telegramUserId: true,
//       },
//     });

//     // Tell sender that request was declined.
//     if (sender) {
//       try {
//         await ctx.telegram.sendMessage(
//           Number(sender.telegramUserId),
//           "❌ <b>Reconnect declined</b>\n\n" +
//             "Your previous partner declined the reconnect request.",
//           {
//             parse_mode: "HTML",
//           }
//         );
//       } catch (partnerError) {
//         console.error(
//           "Failed to notify reconnect sender:",
//           partnerError
//         );
//       }
//     }

//     await ctx.reply(
//       "❌ <b>Reconnect declined.</b>\n\n" +
//         "The reconnect request has been declined.",
//       {
//         parse_mode: "HTML",
//       }
//     );

//     await ctx.answerCbQuery("Request declined.");

//     return;
//   } catch (error) {
//     console.error(
//       "Failed to decline reconnect request:",
//       error
//     );

//     await ctx.answerCbQuery(
//       "Could not decline reconnect request."
//     );

//     return;
//   }
// }

//   await ctx.answerCbQuery();
// });
// }





// import type { Telegraf } from "telegraf";
// import prisma from "@/lib/db";

// import {
//   createReconnectRequest,
//   acceptReconnectRequest,
//   declineReconnectRequest,
//   getReconnectRequestById,
// } from "@/lib/telegram/reconnect";

// import {
//   getPreviousPartner,
//   getPreviousPartnerId,
// } from "@/lib/telegram/previous-partners";

// import {
//   getGenderKeyboard,
//   getMainMenuKeyboard,
// } from "@/lib/telegram/menu";

// import {
//   getConnectedMessage,
//   showMainMenu,
//    getVipMessage,
//    getConnectedMessageWithVip,

// } from "@/lib/telegram/messages";

// import { findAndCreateMatch } from "@/lib/telegram/matching";

// export function registerCallbackHandlers(bot: Telegraf) {
//   bot.on("callback_query", async (ctx) => {
//     const telegramUserId = ctx.from.id;

//     if (!("data" in ctx.callbackQuery)) {
//       await ctx.answerCbQuery();
//       return;
//     }

//     const data = ctx.callbackQuery.data;

//     // ==========================================
//     // GENDER
//     // ==========================================

//     if (data.startsWith("gender_")) {
//       let gender = "";

//       switch (data) {
//         case "gender_male":
//           gender = "Male";
//           break;

//         case "gender_female":
//           gender = "Female";
//           break;

//         case "gender_trans_man":
//           gender = "Trans Man";
//           break;

//         case "gender_trans_woman":
//           gender = "Trans Woman";
//           break;

//         case "gender_non_binary":
//           gender = "Non-binary";
//           break;

//         default:
//           await ctx.answerCbQuery(
//             "Invalid gender selection."
//           );
//           return;
//       }

//       try {
//         await prisma.user.upsert({
//           where: {
//             telegramUserId: BigInt(telegramUserId),
//           },

//           update: {
//             username: ctx.from.username ?? null,
//             firstName: ctx.from.first_name,
//             lastName: ctx.from.last_name ?? null,
//             languageCode: ctx.from.language_code ?? null,
//             isTelegramPremium:
//               ctx.from.is_premium ?? false,
//             gender,
//           },

//           create: {
//             telegramUserId: BigInt(telegramUserId),
//             username: ctx.from.username ?? null,
//             firstName: ctx.from.first_name,
//             lastName: ctx.from.last_name ?? null,
//             languageCode:
//               ctx.from.language_code ?? null,
//             isTelegramPremium:
//               ctx.from.is_premium ?? false,
//             gender,
//           },
//         });

//         await ctx.answerCbQuery("Profile saved");

//         await ctx.editMessageText(
//           "✅ Profile setup complete!\n\n" +
//             `👤 Gender: ${gender}\n\n` +
//             "🔒 Your Telegram identity will not be automatically shared with your chat partner.\n\n" +
//             "You can now find someone to talk to anonymously."
//         );

//         await showMainMenu(ctx);
//       } catch (error) {
//         console.error(
//           "Failed to save profile:",
//           error
//         );

//         await ctx.answerCbQuery(
//           "Failed to save profile."
//         );

//         await ctx.editMessageText(
//           "❌ We couldn't save your profile.\n\n" +
//             "Please try again."
//         );
//       }

//       return;
//     }

//     // ==========================================
//     // FIND SOMEONE
//     // ==========================================

//     if (data === "menu_find") {
//       await ctx.answerCbQuery();

//       try {
//         const user = await prisma.user.findUnique({
//           where: {
//             telegramUserId: BigInt(telegramUserId),
//           },
//           select: {
//             gender: true,
//           },
//         });

//         if (!user?.gender) {
//           await ctx.editMessageText(
//             "🔒 Complete your profile first.\n\n" +
//               "You need to select your gender before you can find someone.",
//             {
//               reply_markup: {
//                 inline_keyboard: [
//                   [
//                     {
//                       text: "👤 Select Gender",
//                       callback_data: "select_gender",
//                     },
//                   ],
//                   [
//                     {
//                       text: "⬅️ Back",
//                       callback_data:
//                         "back_main_menu",
//                     },
//                   ],
//                 ],
//               },
//             }
//           );

//           return;
//         }

//         await ctx.editMessageText(
//           "🔎 Find Someone\n\n" +
//             "Ready to meet someone anonymously?",
//           {
//             reply_markup: {
//               inline_keyboard: [
//                 [
//                   {
//                     text: "🔎 Start Searching",
//                     callback_data: "find_start",
//                   },
//                 ],
//                 [
//                   {
//                     text: "⬅️ Back to Menu",
//                     callback_data:
//                       "back_main_menu",
//                   },
//                 ],
//               ],
//             },
//           }
//         );
//       } catch (error) {
//         console.error(
//           "Failed to check profile:",
//           error
//         );

//         await ctx.editMessageText(
//           "❌ Could not check your profile.\n\n" +
//             "Please try again."
//         );
//       }

//       return;
//     }

//     // ==========================================
//     // SELECT GENDER
//     // ==========================================

//     if (data === "select_gender") {
//       await ctx.answerCbQuery();

//       await ctx.editMessageText(
//         "👤 Choose your gender\n\n" +
//           "You need to select one option to continue.",
//         {
//           reply_markup: getGenderKeyboard(),
//         }
//       );

//       return;
//     }

//     // ==========================================
//     // MY PROFILE
//     // ==========================================

//     if (data === "menu_profile") {
//       await ctx.answerCbQuery();

//       try {
//         const user = await prisma.user.findUnique({
//           where: {
//             telegramUserId: BigInt(telegramUserId),
//           },
//         });

//         if (!user) {
//           await ctx.editMessageText(
//             "👤 My Profile\n\n" +
//               "⚠️ Your profile has not been created yet.",
//             {
//               reply_markup: {
//                 inline_keyboard: [
//                   [
//                     {
//                       text: "👤 Select Gender",
//                       callback_data:
//                         "select_gender",
//                     },
//                   ],
//                   [
//                     {
//                       text: "⬅️ Back",
//                       callback_data:
//                         "back_main_menu",
//                     },
//                   ],
//                 ],
//               },
//             }
//           );

//           return;
//         }

//         await ctx.editMessageText(
//           "👤 My Profile\n\n" +
//             `👤 Gender: ${user.gender}\n\n` +
//             `👤 Username: ${
//               user.username
//                 ? `@${user.username}`
//                 : "Not set"
//             }\n` +
//             `🌐 Language: ${
//               user.languageCode ??
//               "Not available"
//             }\n\n` +
//             "🔒 Your Telegram identity is not automatically shared with your chat partner.",
//           {
//             reply_markup: {
//               inline_keyboard: [
//                 [
//                   {
//                     text: "⬅️ Back to Menu",
//                     callback_data:
//                       "back_main_menu",
//                   },
//                 ],
//               ],
//             },
//           }
//         );
//       } catch (error) {
//         console.error(
//           "Failed to load profile:",
//           error
//         );

//         await ctx.editMessageText(
//           "❌ Could not load your profile.\n\n" +
//             "Please try again.",
//           {
//             reply_markup: {
//               inline_keyboard: [
//                 [
//                   {
//                     text: "⬅️ Back to Menu",
//                     callback_data:
//                       "back_main_menu",
//                   },
//                 ],
//               ],
//             },
//           }
//         );
//       }

//       return;
//     }

//     // ==========================================
//     // SAFETY
//     // ==========================================

//     if (data === "menu_safety") {
//       await ctx.answerCbQuery();

//       await ctx.editMessageText(
//         "🛡️ Safety & Privacy\n\n" +
//           "TalkBuddy is designed for anonymous conversations.\n\n" +
//           "🔒 Your Telegram identity is not automatically shared with your chat partner.\n\n" +
//           "🚫 Blocking and reporting will be added later.",
//         {
//           reply_markup: {
//             inline_keyboard: [
//               [
//                 {
//                   text: "⬅️ Back to Menu",
//                   callback_data:
//                     "back_main_menu",
//                 },
//               ],
//             ],
//           },
//         }
//       );

//       return;
//     }

//     // ==========================================
//     // START SEARCHING
//     // ==========================================

//     if (data === "find_start") {
//       await ctx.answerCbQuery();

//       try {
//         const user = await prisma.user.findUnique({
//           where: {
//             telegramUserId: BigInt(telegramUserId),
//           },
//           select: {
//             id: true,
//             gender: true,
//           },
//         });

//         if (!user?.gender) {
//           await ctx.editMessageText(
//             "🔒 You must select your gender before searching."
//           );

//           return;
//         }

//         // ========================================
//         // CHECK CURRENT STATE
//         // ========================================

//         const currentQueue =
//           await prisma.matchingQueue.findUnique({
//             where: {
//               userId: user.id,
//             },
//             select: {
//               status: true,
//               partnerUserId: true,
//             },
//           });

//         // ========================================
//         // ALREADY CONNECTED
//         // ========================================

// if (currentQueue?.status === "MATCHED") {
//   const connectedMessage =
//     getConnectedMessageWithVip();

//   await ctx.editMessageText(
//     connectedMessage.text,
//     {
//       parse_mode: "HTML",
//       reply_markup:
//         connectedMessage.reply_markup,
//     }
//   );

//   return;
// }
//         // ========================================
//         // ALREADY WAITING
//         //
//         // Find Someone waiting MUST show
//         // Reconnect + Save.
//         // ========================================

//         if (currentQueue?.status === "WAITING") {
//           await ctx.editMessageText(
//             "⏳ <b>Waiting for a partner..</b>\n\n" +
//               "We're looking for someone for you.\n\n" +
//               "Use /end to stop searching.",
//             {
//               parse_mode: "HTML",
//               reply_markup: {
//                 inline_keyboard: [
//                   [
//                     {
//                       text: "🔄 Reconnect previous user",
//                       callback_data:
//                         "reconnect_previous",
//                     },
//                   ],
//                   [
//                     {
//                       text: "💾 Save previous user",
//                       callback_data:
//                         "save_previous",
//                     },
//                   ],
//                 ],
//               },
//             }
//           );

//           return;
//         }

//         // ========================================
//         // PUT USER INTO WAITING QUEUE
//         // ========================================

//         await prisma.matchingQueue.upsert({
//           where: {
//             userId: user.id,
//           },
//           update: {
//             status: "WAITING",
//             partnerUserId: null,
//             joinedAt: new Date(),
//           },
//           create: {
//             userId: user.id,
//             status: "WAITING",
//             partnerUserId: null,
//           },
//         });

//         // ========================================
//         // ATOMICALLY FIND PARTNER
//         // ========================================

//         const match = await findAndCreateMatch(
//           user.id
//         );

//         // ========================================
//         // MATCH FOUND
//         // ========================================

//         if (match) {
//           const partner =
//             await prisma.user.findUnique({
//               where: {
//                 id: match.partnerUserId,
//               },
//               select: {
//                 telegramUserId: true,
//               },
//             });

//           if (partner) {
//             try {
//               await ctx.telegram.sendMessage(
//                 Number(
//                   partner.telegramUserId
//                 ),
//                 getConnectedMessage(),
//                 {
//                   parse_mode: "HTML",
//                 }
//               );
//             } catch (partnerError) {
//               console.error(
//                 "Failed to send connection message to partner:",
//                 partnerError
//               );
//             }
//           }

//           await ctx.editMessageText(
//             getConnectedMessage(),
//             {
//               parse_mode: "HTML",
//             }
//           );

//           return;
//         }

//         // ========================================
//         // NO MATCH
//         //
//         // Normal Find Someone flow DOES show
//         // Reconnect + Save.
//         // ========================================

//         await ctx.editMessageText(
//           "⏳ <b>Waiting for a partner..</b>\n\n" +
//             "We're looking for someone for you.\n\n" +
//             "Use /end to stop searching.",
//           {
//             parse_mode: "HTML",
//             reply_markup: {
//               inline_keyboard: [
//                 [
//                   {
//                     text: "🔄 Reconnect previous user",
//                     callback_data:
//                       "reconnect_previous",
//                   },
//                 ],
//                 [
//                   {
//                     text: "💾 Save previous user",
//                     callback_data:
//                       "save_previous",
//                   },
//                 ],
//               ],
//             },
//           }
//         );
//       } catch (error) {
//         console.error(
//           "Failed to start searching:",
//           error
//         );

//         await ctx.editMessageText(
//           "❌ Could not start searching.\n\n" +
//             "Please try again."
//         );
//       }

//       return;
//     }

//     // ==========================================
//     // BACK TO MAIN MENU
//     // ==========================================

//     if (data === "back_main_menu") {
//       await ctx.answerCbQuery();

//       await ctx.editMessageText(
//         "🏠 TalkBuddy\n\n" +
//           "What would you like to do?",
//         {
//           reply_markup: getMainMenuKeyboard(),
//         }
//       );

//       return;
//     }

//     // ==========================================
//     // RECONNECT PREVIOUS USER
//     // ==========================================

//     if (data === "reconnect_previous") {
//       try {
//         await ctx.answerCbQuery();

//         const user = await prisma.user.findUnique({
//           where: {
//             telegramUserId:
//               BigInt(telegramUserId),
//           },
//           select: {
//             id: true,
//           },
//         });

//         if (!user) {
//           await ctx.reply(
//             "❌ Your profile was not found.\n\n" +
//               "Please use /start."
//           );
//           return;
//         }

//         const previousPartner =
//           await getPreviousPartner(user.id);

//         if (!previousPartner) {
//           await ctx.reply(
//             "ℹ️ You don't have a previous partner yet."
//           );
//           return;
//         }

//         const previousPartnerId =
//           getPreviousPartnerId(
//             previousPartner,
//             user.id
//           );

//         if (!previousPartnerId) {
//           await ctx.reply(
//             "❌ Previous partner could not be found."
//           );
//           return;
//         }

//         const request =
//           await createReconnectRequest(
//             user.id,
//             previousPartnerId
//           );

//         if (!request) {
//           await ctx.reply(
//             "❌ You cannot reconnect with this user right now."
//           );
//           return;
//         }

//         const receiver =
//           await prisma.user.findUnique({
//             where: {
//               id: previousPartnerId,
//             },
//             select: {
//               telegramUserId: true,
//             },
//           });

//         if (!receiver) {
//           await ctx.reply(
//             "❌ Your previous partner is no longer available."
//           );
//           return;
//         }

//         await ctx.telegram.sendMessage(
//           Number(receiver.telegramUserId),
//           "<b>🔄 Reconnect Request</b>\n\n" +
//             "Your previous TalkBuddy partner wants to reconnect with you.\n\n" +
//             "Would you like to reconnect?",
//           {
//             parse_mode: "HTML",
//             reply_markup: {
//               inline_keyboard: [
//                 [
//                   {
//                     text: "✅ Accept",
//                     callback_data:
//                       `reconnect_accept_${request.id}`,
//                   },
//                   {
//                     text: "❌ Decline",
//                     callback_data:
//                       `reconnect_decline_${request.id}`,
//                   },
//                 ],
//               ],
//             },
//           }
//         );

//         await ctx.reply(
//           "<b>📨 Reconnect request sent</b>\n\n" +
//             "Your previous partner has been notified.\n\n" +
//             "Waiting for their response.",
//           {
//             parse_mode: "HTML",
//           }
//         );

//         return;
//       } catch (error) {
//         console.error(
//           "Failed to create reconnect request:",
//           error
//         );

//         await ctx.reply(
//           "❌ Could not send the reconnect request.\n\n" +
//             "Please try again."
//         );

//         return;
//       }
//     }

//     // ==========================================
//     // ACCEPT RECONNECT REQUEST
//     // ==========================================

//     if (data.startsWith("reconnect_accept_")) {
//       const requestId = data.replace(
//         "reconnect_accept_",
//         ""
//       );

//       try {
//         await ctx.answerCbQuery();

//         const user = await prisma.user.findUnique({
//           where: {
//             telegramUserId:
//               BigInt(telegramUserId),
//           },
//           select: {
//             id: true,
//           },
//         });

//         if (!user) {
//           await ctx.reply(
//             "❌ Your profile was not found."
//           );
//           return;
//         }

//         // Verify the request BEFORE accepting.
//         const request =
//           await getReconnectRequestById(
//             requestId
//           );

//         if (!request) {
//           await ctx.editMessageReplyMarkup({
//             inline_keyboard: [],
//           }).catch(() => {});

//           await ctx.reply(
//             "❌ Reconnect request not found."
//           );

//           return;
//         }

//         // Security check:
//         // Only receiver can accept.
//         if (request.receiverId !== user.id) {
//           await ctx.reply(
//             "❌ This reconnect request is not for you."
//           );

//           return;
//         }

//         // Cancelled / declined / accepted requests
//         // cannot be accepted again.
//         if (request.status !== "PENDING") {
//           await ctx.editMessageReplyMarkup({
//             inline_keyboard: [],
//           }).catch(() => {});

//           await ctx.reply(
//             "ℹ️ This reconnect request is no longer available."
//           );

//           return;
//         }

//         const result =
//           await acceptReconnectRequest(
//             requestId,
//             user.id
//           );

//         if (!result) {
//           await ctx.editMessageReplyMarkup({
//             inline_keyboard: [],
//           }).catch(() => {});

//           await ctx.reply(
//             "❌ This reconnect request could not be accepted.\n\n" +
//               "The request may no longer be available."
//           );

//           return;
//         }

//         // Remove Accept / Decline buttons.
//         await ctx.editMessageReplyMarkup({
//           inline_keyboard: [],
//         }).catch(() => {});

//         // ========================================
//         // NOTIFY SENDER
//         // ========================================

//         const sender =
//           await prisma.user.findUnique({
//             where: {
//               id: result.senderId,
//             },
//             select: {
//               telegramUserId: true,
//             },
//           });

//         if (sender) {
//           try {
//             await ctx.telegram.sendMessage(
//               Number(sender.telegramUserId),
//               getConnectedMessage(),
//               {
//                 parse_mode: "HTML",
//               }
//             );
//           } catch (partnerError) {
//             console.error(
//               "Failed to notify reconnect sender:",
//               partnerError
//             );
//           }
//         }

//         // ========================================
//         // CONNECT RECEIVER
//         // ========================================

//         await ctx.reply(
//           getConnectedMessage(),
//           {
//             parse_mode: "HTML",
//           }
//         );

//         return;
//       } catch (error) {
//         console.error(
//           "Failed to accept reconnect request:",
//           error
//         );

//         await ctx.reply(
//           "❌ Could not accept the reconnect request.\n\n" +
//             "Please try again."
//         );

//         return;
//       }
//     }

//     // ==========================================
//     // DECLINE RECONNECT REQUEST
//     // ==========================================

//     if (data.startsWith("reconnect_decline_")) {
//       const requestId = data.replace(
//         "reconnect_decline_",
//         ""
//       );

//       try {
//         await ctx.answerCbQuery();

//         const user = await prisma.user.findUnique({
//           where: {
//             telegramUserId:
//               BigInt(telegramUserId),
//           },
//           select: {
//             id: true,
//           },
//         });

//         if (!user) {
//           await ctx.reply(
//             "❌ Your profile was not found."
//           );
//           return;
//         }

//         const request =
//           await getReconnectRequestById(
//             requestId
//           );

//         if (!request) {
//           await ctx.editMessageReplyMarkup({
//             inline_keyboard: [],
//           }).catch(() => {});

//           await ctx.reply(
//             "❌ Reconnect request not found."
//           );

//           return;
//         }

//         // Security check.
//         if (request.receiverId !== user.id) {
//           await ctx.reply(
//             "❌ This request is not for you."
//           );

//           return;
//         }

//         // Cannot decline something already
//         // cancelled / accepted / declined.
//         if (request.status !== "PENDING") {
//           await ctx.editMessageReplyMarkup({
//             inline_keyboard: [],
//           }).catch(() => {});

//           await ctx.reply(
//             "ℹ️ This reconnect request is no longer pending."
//           );

//           return;
//         }

//         const result =
//           await declineReconnectRequest(
//             requestId,
//             user.id
//           );

//         if (result.count === 0) {
//           await ctx.editMessageReplyMarkup({
//             inline_keyboard: [],
//           }).catch(() => {});

//           await ctx.reply(
//             "ℹ️ This reconnect request is no longer available."
//           );

//           return;
//         }

//         // Remove buttons.
//         await ctx.editMessageReplyMarkup({
//           inline_keyboard: [],
//         }).catch(() => {});

//         // ========================================
//         // NOTIFY SENDER
//         // ========================================

//         const sender =
//           await prisma.user.findUnique({
//             where: {
//               id: request.senderId,
//             },
//             select: {
//               telegramUserId: true,
//             },
//           });

//         if (sender) {
//           try {
//             await ctx.telegram.sendMessage(
//               Number(sender.telegramUserId),
//               "❌ <b>Reconnect declined</b>\n\n" +
//                 "Your previous partner declined the reconnect request.",
//               {
//                 parse_mode: "HTML",
//               }
//             );
//           } catch (partnerError) {
//             console.error(
//               "Failed to notify reconnect sender:",
//               partnerError
//             );
//           }
//         }

//         // ========================================
//         // NOTIFY RECEIVER
//         // ========================================

//         await ctx.reply(
//           "❌ <b>Reconnect declined.</b>\n\n" +
//             "The reconnect request has been declined.\n\n" +
//             "Use /next to find someone new.",
//           {
//             parse_mode: "HTML",
//           }
//         );

//         return;
//       } catch (error) {
//         console.error(
//           "Failed to decline reconnect request:",
//           error
//         );

//         await ctx.reply(
//           "❌ Could not decline the reconnect request.\n\n" +
//             "Please try again."
//         );

//         return;
//       }
//     }

//     // ==========================================
//     // SAVE PREVIOUS USER
//     // ==========================================
//     //
//     // UI ONLY FOR NOW.
//     // No backend implementation yet.
    
//     //

//     // ==========================================
// // VIP
// // ==========================================

// if (data === "vip_info") {
//   await ctx.answerCbQuery();

//   await ctx.reply(
//     getVipMessage(),
//     {
//       parse_mode: "HTML",
//       reply_markup: {
//         inline_keyboard: [
//           [
//             {
//               text: "💎 VIP Coming Soon",
//               callback_data: "vip_coming_soon",
//             },
//           ],
//           [
//             {
//               text: "⬅️ Back to Menu",
//               callback_data: "back_main_menu",
//             },
//           ],
//         ],
//       },
//     }
//   );

//   return;
// }

// // ==========================================
// // VIP COMING SOON
// // ==========================================

// if (data === "vip_coming_soon") {
//   await ctx.answerCbQuery(
//     "💎 VIP is coming soon!"
//   );

//   return;
// }


//     if (data === "save_previous") {
//       await ctx.answerCbQuery(
//         "Save feature will be added later."
//       );
//       return;
//     }

//     // ==========================================
//     // FALLBACK
//     // ==========================================

//     await ctx.answerCbQuery();
//   });
// }



import type { Telegraf } from "telegraf";
import prisma from "@/lib/db";

import {
  createReconnectRequest,
  acceptReconnectRequest,
  declineReconnectRequest,
  getReconnectRequestById,
} from "@/lib/telegram/reconnect";

import {
  getPreviousPartner,
  getPreviousPartnerId,
} from "@/lib/telegram/previous-partners";

import {
  clearSavePartnerState,
  setSavePartnerState,
} from "@/lib/telegram/saved-partners";

import {
  getGenderKeyboard,
  getMainMenuKeyboard,
  getVipKeyboard,
} from "@/lib/telegram/menu";

import {
  getConnectedMessage,
  getConnectedMessageWithVip,
  showMainMenu,
  getVipMessage,
} from "@/lib/telegram/messages";

import { findAndCreateMatch } from "@/lib/telegram/matching";
import { type VipPlanKey, getUserVipStatus } from "@/lib/telegram/vip";
import {
  showVipMenu,
  handleVipPackageSelect,
  handleVipConfirmActivation,
} from "@/lib/telegram/handlers/vip";
import { saveUserSetting } from "@/lib/telegram/user-settings";
import { renderSettingsMenu, showUserProfile } from "@/lib/telegram/handlers/features";

export function registerCallbackHandlers(bot: Telegraf) {
  bot.on("callback_query", async (ctx, next) => {
    const telegramUserId = ctx.from.id;

    if (!("data" in ctx.callbackQuery)) {
      await ctx.answerCbQuery();
      return;
    }

    const data = ctx.callbackQuery.data;

    // ==========================================
    // GENDER
    // ==========================================

    if (data.startsWith("gender_")) {
      let gender = "";

      switch (data) {
        case "gender_male":
          gender = "Male";
          break;

        case "gender_female":
          gender = "Female";
          break;

        case "gender_trans_man":
          gender = "Trans Man";
          break;

        case "gender_trans_woman":
          gender = "Trans Woman";
          break;

        case "gender_non_binary":
          gender = "Non-binary";
          break;

        default:
          await ctx.answerCbQuery(
            "Invalid gender selection."
          );
          return;
      }

      try {
        await prisma.user.upsert({
          where: {
            telegramUserId: BigInt(telegramUserId),
          },

          update: {
            username: ctx.from.username ?? null,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name ?? null,
            languageCode: ctx.from.language_code ?? null,
            isTelegramPremium:
              ctx.from.is_premium ?? false,
            gender,
          },

          create: {
            telegramUserId: BigInt(telegramUserId),
            username: ctx.from.username ?? null,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name ?? null,
            languageCode:
              ctx.from.language_code ?? null,
            isTelegramPremium:
              ctx.from.is_premium ?? false,
            gender,
          },
        });

        await saveUserSetting(telegramUserId, { gender });

        await ctx.answerCbQuery("Profile saved");

        await ctx.editMessageText(
          "✅ Profile setup complete!\n\n" +
            `👤 Gender: ${gender}\n\n` +
            "🔒 Your Telegram identity will not be automatically shared with your chat partner.\n\n" +
            "You can now find someone to talk to anonymously."
        );

        await showMainMenu(ctx);
      } catch (error) {
        console.error(
          "Failed to save profile:",
          error
        );

        await ctx.answerCbQuery(
          "Failed to save profile."
        );

        await ctx.editMessageText(
          "❌ We couldn't save your profile.\n\n" +
            "Please try again."
        );
      }

      return;
    }

    // ==========================================
    // FIND SOMEONE
    // ==========================================

    if (data === "menu_find") {
      await ctx.answerCbQuery();

      try {
        const user = await prisma.user.findUnique({
          where: {
            telegramUserId: BigInt(telegramUserId),
          },
          select: {
            gender: true,
          },
        });

        if (!user?.gender) {
          await ctx.editMessageText(
            "🔒 Complete your profile first.\n\n" +
              "You need to select your gender before you can find someone.",
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "👤 Select Gender",
                      callback_data: "select_gender",
                    },
                  ],
                  [
                    {
                      text: "⬅️ Back",
                      callback_data:
                        "back_main_menu",
                    },
                  ],
                ],
              },
            }
          );

          return;
        }

        await ctx.editMessageText(
          "🔎 Find Someone\n\n" +
            "Ready to meet someone anonymously?",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔎 Start Searching",
                    callback_data: "find_start",
                  },
                ],
                [
                  {
                    text: "⬅️ Back to Menu",
                    callback_data:
                      "back_main_menu",
                  },
                ],
              ],
            },
          }
        );
      } catch (error) {
        console.error(
          "Failed to check profile:",
          error
        );

        await ctx.editMessageText(
          "❌ Could not check your profile.\n\n" +
            "Please try again."
        );
      }

      return;
    }

    // ==========================================
    // SELECT GENDER
    // ==========================================

    if (data === "select_gender") {
      await ctx.answerCbQuery();

      await ctx.editMessageText(
        "👤 Choose your gender\n\n" +
          "You need to select one option to continue.",
        {
          reply_markup: getGenderKeyboard(),
        }
      );

      return;
    }

    // ==========================================
    // MY PROFILE
    // ==========================================

    if (data === "menu_profile") {
      await ctx.answerCbQuery().catch(() => {});
      await showUserProfile(ctx);
      return;
    }

    // ==========================================
    // SAFETY
    // ==========================================

    if (data === "menu_safety") {
      await ctx.answerCbQuery();

      await ctx.editMessageText(
        "🛡️ Safety & Privacy\n\n" +
          "TalkBuddy is designed for anonymous conversations.\n\n" +
          "🔒 Your Telegram identity is not automatically shared with your chat partner.\n\n" +
          "🚫 Blocking and reporting will be added later.",
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "⬅️ Back to Menu",
                  callback_data:
                    "back_main_menu",
                },
              ],
            ],
          },
        }
      );

      return;
    }

    // ==========================================
    // BACK TO MAIN MENU
    // ==========================================

    if (data === "back_main_menu") {
      await ctx.answerCbQuery().catch(() => {});
      await showMainMenu(ctx);
      return;
    }

    // ==========================================
    // SETTINGS & VERIFICATION MENU
    // ==========================================

    if (data === "menu_settings" || data === "settings_profile") {
      try {
        await ctx.answerCbQuery();
      } catch {}
      await renderSettingsMenu(ctx);
      return;
    }

    // ==========================================
    // START SEARCHING
    // ==========================================

    if (data === "find_start") {
      await ctx.answerCbQuery();

      try {
        const user = await prisma.user.findUnique({
          where: {
            telegramUserId: BigInt(telegramUserId),
          },
          select: {
            id: true,
            gender: true,
          },
        });

        if (!user?.gender) {
          await ctx.editMessageText(
            "🔒 You must select your gender before searching."
          );

          return;
        }

        // ========================================
        // CHECK CURRENT STATE
        // ========================================

        const currentQueue =
          await prisma.matchingQueue.findUnique({
            where: {
              userId: user.id,
            },
            select: {
              status: true,
              partnerUserId: true,
            },
          });

        // ========================================
        // ALREADY CONNECTED
        // ========================================

        if (currentQueue?.status === "MATCHED") {
          const connectedMessage =
            getConnectedMessageWithVip();

          await ctx.editMessageText(
            connectedMessage.text,
            {
              parse_mode: "HTML",
              reply_markup:
                connectedMessage.reply_markup,
            }
          );

          return;
        }

        // ========================================
        // ALREADY WAITING
        // ========================================

        if (currentQueue?.status === "WAITING") {
          await ctx.editMessageText(
            "⏳ <b>Waiting for a partner..</b>\n\n" +
              "We're looking for someone for you.\n\n" +
              "Use /end to stop searching.",
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "🔄 Reconnect previous user",
                      callback_data:
                        "reconnect_previous",
                    },
                    {
                      text: "💾 Save previous user",
                      callback_data:
                        "save_previous",
                    },
                  ],
                ],
              },
            }
          );

          return;
        }

        // ========================================
        // PUT USER INTO WAITING QUEUE
        // ========================================

        await prisma.matchingQueue.upsert({
          where: {
            userId: user.id,
          },
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

        // ========================================
        // ATOMICALLY FIND PARTNER
        // ========================================

        const match = await findAndCreateMatch(
          user.id
        );

        // ========================================
        // MATCH FOUND
        // ========================================

        if (match) {
          const partner =
            await prisma.user.findUnique({
              where: {
                id: match.partnerUserId,
              },
              select: {
                telegramUserId: true,
              },
            });

          if (partner) {
            try {
              const connectedMessage =
                getConnectedMessageWithVip();

              await ctx.telegram.sendMessage(
                Number(
                  partner.telegramUserId
                ),
                connectedMessage.text,
                {
                  parse_mode: "HTML",
                  reply_markup:
                    connectedMessage.reply_markup,
                }
              );
            } catch (partnerError) {
              console.error(
                "Failed to send connection message to partner:",
                partnerError
              );
            }
          }

          const connectedMessage =
            getConnectedMessageWithVip();

          await ctx.editMessageText(
            connectedMessage.text,
            {
              parse_mode: "HTML",
              reply_markup:
                connectedMessage.reply_markup,
            }
          );

          return;
        }

        // ========================================
        // NO MATCH
        // ========================================

        await ctx.editMessageText(
          "⏳ <b>Waiting for a partner..</b>\n\n" +
            "We're looking for someone for you.\n\n" +
            "Use /end to stop searching.",
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🔄 Reconnect previous user",
                    callback_data:
                      "reconnect_previous",
                  },
                  {
                    text: "💾 Save previous user",
                    callback_data:
                      "save_previous",
                  },
                ],
              ],
            },
          }
        );
      } catch (error) {
        console.error(
          "Failed to start searching:",
          error
        );

        await ctx.editMessageText(
          "❌ Could not start searching.\n\n" +
            "Please try again."
        );
      }

      return;
    }

    // ==========================================
    // BACK TO MAIN MENU
    // ==========================================

    if (data === "back_main_menu") {
      await ctx.answerCbQuery();

      await ctx.editMessageText(
        "🏠 TalkBuddy\n\n" +
          "What would you like to do?",
        {
          reply_markup: getMainMenuKeyboard(),
        }
      );

      return;
    }

    // ==========================================
    // RECONNECT PREVIOUS USER
    // ==========================================

    if (data === "reconnect_previous") {
      try {
        await ctx.answerCbQuery();

        const user = await prisma.user.findUnique({
          where: {
            telegramUserId:
              BigInt(telegramUserId),
          },
          select: {
            id: true,
          },
        });

        if (!user) {
          await ctx.reply(
            "❌ Your profile was not found.\n\n" +
              "Please use /start."
          );
          return;
        }

        const previousPartner =
          await getPreviousPartner(user.id);

        if (!previousPartner) {
          await ctx.reply(
            "ℹ️ You don't have a previous partner yet."
          );
          return;
        }

        const previousPartnerId =
          getPreviousPartnerId(
            previousPartner,
            user.id
          );

        if (!previousPartnerId) {
          await ctx.reply(
            "❌ Previous partner could not be found."
          );
          return;
        }

        const request =
          await createReconnectRequest(
            user.id,
            previousPartnerId
          );

        if (!request) {
          await ctx.reply(
            "❌ You cannot reconnect with this user right now."
          );
          return;
        }

        const receiver =
          await prisma.user.findUnique({
            where: {
              id: previousPartnerId,
            },
            select: {
              telegramUserId: true,
            },
          });

        if (!receiver) {
          await ctx.reply(
            "❌ Your previous partner is no longer available."
          );
          return;
        }

        await ctx.telegram.sendMessage(
          Number(receiver.telegramUserId),
          "<b>🔄 Reconnect Request</b>\n\n" +
            "Your previous TalkBuddy partner wants to reconnect with you.\n\n" +
            "Would you like to reconnect?",
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ Accept",
                    callback_data:
                      `reconnect_accept_${request.id}`,
                  },
                  {
                    text: "❌ Decline",
                    callback_data:
                      `reconnect_decline_${request.id}`,
                  },
                ],
              ],
            },
          }
        );

        await ctx.reply(
          "<b>📨 Reconnect request sent</b>\n\n" +
            "Your previous partner has been notified.\n\n" +
            "Waiting for their response.",
          {
            parse_mode: "HTML",
          }
        );

        return;
      } catch (error) {
        console.error(
          "Failed to create reconnect request:",
          error
        );

        await ctx.reply(
          "❌ Could not send the reconnect request.\n\n" +
            "Please try again."
        );

        return;
      }
    }

    // ==========================================
    // ACCEPT RECONNECT REQUEST
    // ==========================================

    if (data.startsWith("reconnect_accept_")) {
      const requestId = data.replace(
        "reconnect_accept_",
        ""
      );

      try {
        await ctx.answerCbQuery();

        const user = await prisma.user.findUnique({
          where: {
            telegramUserId:
              BigInt(telegramUserId),
          },
          select: {
            id: true,
          },
        });

        if (!user) {
          await ctx.reply(
            "❌ Your profile was not found."
          );
          return;
        }

        const request =
          await getReconnectRequestById(
            requestId
          );

        if (!request) {
          await ctx
            .editMessageReplyMarkup({
              inline_keyboard: [],
            })
            .catch(() => {});

          await ctx.reply(
            "❌ Reconnect request not found."
          );

          return;
        }

        if (request.receiverId !== user.id) {
          await ctx.reply(
            "❌ This reconnect request is not for you."
          );

          return;
        }

        if (request.status !== "PENDING") {
          await ctx
            .editMessageReplyMarkup({
              inline_keyboard: [],
            })
            .catch(() => {});

          await ctx.reply(
            "ℹ️ This reconnect request is no longer available."
          );

          return;
        }

        const result =
          await acceptReconnectRequest(
            requestId,
            user.id
          );

        if (!result) {
          await ctx
            .editMessageReplyMarkup({
              inline_keyboard: [],
            })
            .catch(() => {});

          await ctx.reply(
            "❌ This reconnect request could not be accepted.\n\n" +
              "The request may no longer be available."
          );

          return;
        }

        await ctx
          .editMessageReplyMarkup({
            inline_keyboard: [],
          })
          .catch(() => {});

        // ========================================
        // NOTIFY SENDER
        // ========================================

        const sender =
          await prisma.user.findUnique({
            where: {
              id: result.senderId,
            },
            select: {
              telegramUserId: true,
            },
          });

        if (sender) {
          try {
            const connectedMessage =
              getConnectedMessageWithVip();

            await ctx.telegram.sendMessage(
              Number(sender.telegramUserId),
              connectedMessage.text,
              {
                parse_mode: "HTML",
                reply_markup:
                  connectedMessage.reply_markup,
              }
            );
          } catch (partnerError) {
            console.error(
              "Failed to notify reconnect sender:",
              partnerError
            );
          }
        }

        // ========================================
        // CONNECT RECEIVER
        // ========================================

        const connectedMessage =
          getConnectedMessageWithVip();

        await ctx.reply(
          connectedMessage.text,
          {
            parse_mode: "HTML",
            reply_markup:
              connectedMessage.reply_markup,
          }
        );

        return;
      } catch (error) {
        console.error(
          "Failed to accept reconnect request:",
          error
        );

        await ctx.reply(
          "❌ Could not accept the reconnect request.\n\n" +
            "Please try again."
        );

        return;
      }
    }

    // ==========================================
    // DECLINE RECONNECT REQUEST
    // ==========================================

    if (data.startsWith("reconnect_decline_")) {
      const requestId = data.replace(
        "reconnect_decline_",
        ""
      );

      try {
        await ctx.answerCbQuery();

        const user = await prisma.user.findUnique({
          where: {
            telegramUserId:
              BigInt(telegramUserId),
          },
          select: {
            id: true,
          },
        });

        if (!user) {
          await ctx.reply(
            "❌ Your profile was not found."
          );
          return;
        }

        const request =
          await getReconnectRequestById(
            requestId
          );

        if (!request) {
          await ctx
            .editMessageReplyMarkup({
              inline_keyboard: [],
            })
            .catch(() => {});

          await ctx.reply(
            "❌ Reconnect request not found."
          );

          return;
        }

        if (request.receiverId !== user.id) {
          await ctx.reply(
            "❌ This request is not for you."
          );

          return;
        }

        if (request.status !== "PENDING") {
          await ctx
            .editMessageReplyMarkup({
              inline_keyboard: [],
            })
            .catch(() => {});

          await ctx.reply(
            "ℹ️ This reconnect request is no longer pending."
          );

          return;
        }

        const result =
          await declineReconnectRequest(
            requestId,
            user.id
          );

        if (result.count === 0) {
          await ctx
            .editMessageReplyMarkup({
              inline_keyboard: [],
            })
            .catch(() => {});

          await ctx.reply(
            "ℹ️ This reconnect request is no longer available."
          );

          return;
        }

        await ctx
          .editMessageReplyMarkup({
            inline_keyboard: [],
          })
          .catch(() => {});

        // ========================================
        // NOTIFY SENDER
        // ========================================

        const sender =
          await prisma.user.findUnique({
            where: {
              id: request.senderId,
            },
            select: {
              telegramUserId: true,
            },
          });

        if (sender) {
          try {
            await ctx.telegram.sendMessage(
              Number(sender.telegramUserId),
              "❌ <b>Reconnect declined</b>\n\n" +
                "Your previous partner declined the reconnect request.",
              {
                parse_mode: "HTML",
              }
            );
          } catch (partnerError) {
            console.error(
              "Failed to notify reconnect sender:",
              partnerError
            );
          }
        }

        // ========================================
        // NOTIFY RECEIVER
        // ========================================

        await ctx.reply(
          "❌ <b>Reconnect declined.</b>\n\n" +
            "The reconnect request has been declined.\n\n" +
            "Use /next to find someone new.",
          {
            parse_mode: "HTML",
          }
        );

        return;
      } catch (error) {
        console.error(
          "Failed to decline reconnect request:",
          error
        );

        await ctx.reply(
          "❌ Could not decline the reconnect request.\n\n" +
            "Please try again."
        );

        return;
      }
    }

    // ==========================================
    // VIP INFO
    // ==========================================

    if (data === "vip_info") {
      await showVipMenu(ctx);
      return;
    }

    // ==========================================
    // VIP PACKAGE SELECT (CHECK TELEGRAM POINTS)
    // ==========================================

    if (data.startsWith("vip_buy_") || data.startsWith("vip_select_")) {
      const planKey = data.replace(/^vip_(buy|select)_/, "") as VipPlanKey;
      await handleVipPackageSelect(ctx, planKey);
      return;
    }

    // ==========================================
    // VIP CONFIRM ACTIVATION
    // ==========================================

    if (data.startsWith("vip_confirm_")) {
      const planKey = data.replace("vip_confirm_", "") as VipPlanKey;
      await handleVipConfirmActivation(ctx, planKey);
      return;
    }

    // ==========================================
    // SAVE PREVIOUS USER
    // ==========================================

    if (data === "save_previous") {
      try {
        await ctx.answerCbQuery();

        const user = await prisma.user.findUnique({
          where: {
            telegramUserId: BigInt(telegramUserId),
          },
          select: {
            id: true,
            pointsBalance: true,
          },
        });

        if (!user) {
          await ctx.reply(
            "❌ Your profile was not found.\n\n" +
              "Please use /start."
          );

          return;
        }

        const previousPartner =
          await getPreviousPartner(user.id);

        if (!previousPartner) {
          await ctx.reply(
            "ℹ️ You don't have a previous partner to save yet."
          );

          return;
        }

        const previousPartnerId =
          getPreviousPartnerId(
            previousPartner,
            user.id
          );

        if (!previousPartnerId) {
          await ctx.reply(
            "❌ Previous partner could not be found."
          );

          return;
        }

        if (previousPartner.nickname) {
          await ctx.reply(
            "💾 <b>Partner Already Saved</b>\n\n" +
              `🏷️ Nickname: <b>${previousPartner.nickname}</b>\n\n` +
              "This previous partner has already been saved.",
            {
              parse_mode: "HTML",
            }
          );

          return;
        }

        await setSavePartnerState(
          user.id,
          "WAITING_FOR_NICKNAME"
        );

        await ctx.reply(
          "📝 <b>Saving Partner</b>\n\n" +
            "Enter a nickname for this user (3-15 chars, letters/numbers only).\n\n" +
            "Please send the nickname as your next message.",
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "❌ Cancel",
                    callback_data:
                      "save_partner_cancel",
                  },
                ],
              ],
            },
          }
        );

        return;
      } catch (error) {
        console.error(
          "Failed to start save partner flow:",
          error
        );

        await ctx.reply(
          "❌ Could not start saving this partner.\n\n" +
            "Please try again."
        );

        return;
      }
    }

    if (data === "save_partner_cancel") {
      try {
        await ctx.answerCbQuery();

        const user = await prisma.user.findUnique({
          where: {
            telegramUserId: BigInt(telegramUserId),
          },
          select: { id: true },
        });

        if (user) {
          await clearSavePartnerState(user.id);
        }

        await ctx.reply("❌ Save cancelled.");
        return;
      } catch (error) {
        console.error(
          "Failed to cancel save partner flow:",
          error
        );

        await ctx.reply(
          "❌ Could not cancel the save partner flow.\n\n" +
            "Please try again."
        );

        return;
      }
    }

    // ==========================================
    // FALLBACK
    // ==========================================

    if (typeof next === "function") {
      return next();
    }

    await ctx.answerCbQuery();
  });
}