import type { Telegraf } from "telegraf";
import prisma from "@/lib/db";
import { findAndCreateMatch } from "@/lib/telegram/matching";
import {
  showWaitingForPartner,
  showMainMenu,
  showGenderSelection,
  getConnectedMessageWithVip,
} from "@/lib/telegram/messages";
import { getWaitingPartnerKeyboard } from "@/lib/telegram/menu";
import { getUserVipStatus } from "@/lib/telegram/vip";
import { redeemPromoCode } from "@/lib/promocodes";
import { showVipMenu } from "@/lib/telegram/handlers/vip";
import {
  createReconnectRequest,
  cancelPendingReconnectRequests,
} from "@/lib/telegram/reconnect";
import { handleEnd } from "@/lib/telegram/handlers/end";
import { saveUserSetting, getUserSettings } from "@/lib/telegram/user-settings";

async function translateText(
  text: string,
  targetLang: string = "en"
): Promise<{ translatedText: string; sourceLang?: string } | null> {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text.slice(0, 500)
    )}&langpair=autodetect|${targetLang}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.responseData?.translatedText) {
      return {
        translatedText: data.responseData.translatedText,
        sourceLang: data.responseDetails || "auto",
      };
    }
  } catch (err) {
    console.error("Translate error:", err);
  }
  return null;
}

const TRUTH_QUESTIONS = [
  "What is your biggest fear that you haven't told many people?",
  "If you could change one decision from your past, what would it be?",
  "What was your most embarrassing moment?",
  "What is your guilty pleasure song, show, or movie?",
  "What is the sweetest thing someone has ever done for you?",
  "What is the best piece of life advice you've ever received?",
  "If you were given 1 million dollars right now, what is the first thing you'd do?",
  "What is a unique or secret talent you have?",
  "What is your biggest pet peeve in a conversation?",
  "Have you ever had a crush on someone you shouldn't have?",
  "What is something you pretend to understand, but really don't?",
  "What is the most adventurous thing you've ever done?",
  "If you could have dinner with anyone alive or dead, who would it be?",
  "What is one dream you haven't given up on yet?",
  "What is your favorite memory from childhood?",
  "What is the most spontaneous thing you've ever done?",
  "What is one thing that always makes you smile no matter what?",
  "If you could live in any country in the world, where would you choose?",
  "What is a lie you told that got completely out of hand?",
  "What was your first impression of chatting anonymously?",
];

const DARE_CHALLENGES = [
  "Send a 5-second voice note saying something funny in a cartoon voice!",
  "Send the 5th emoji in your recent emojis list and explain why you used it!",
  "Tell a 2-sentence scary story right now!",
  "Give your partner a creative nickname and call them that for the rest of this chat!",
  "Send a lyric from the song currently stuck in your head and let your partner guess the artist!",
  "Send a compliment to your chat partner that rhymes!",
  "Type your next message using only emojis!",
  "Send your favorite GIF that represents your current mood!",
  "Tell a dad joke or cheesy pickup line right now!",
  "Send a photo of something blue in the room you are currently in!",
  "Describe your dream vacation using only 4 words!",
  "Type your next 3 messages in backwards sentence structure (like Yoda)!",
  "Invent a superhero name for yourself based on your last meal!",
  "Send a voice note humming the chorus of a popular song!",
  "Confess your strangest food combination that you actually enjoy!",
];

// ==========================================
// 1. /search — Finds a random user
// ==========================================
export async function handleSearch(ctx: any) {
  try {
    const telegramUserId = BigInt(ctx.from.id);
    let user = await prisma.user.findUnique({
      where: { telegramUserId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramUserId,
          username: ctx.from.username ?? null,
          firstName: ctx.from.first_name || "User",
          lastName: ctx.from.last_name ?? null,
          referralCode: `TB${ctx.from.id}`,
          gender: "",
        },
      });
      await showGenderSelection(ctx);
      return;
    }

    if (!user.gender) {
      await showGenderSelection(ctx);
      return;
    }

    // Cancel pending reconnect requests
    await cancelPendingReconnectRequests(user.id);

    // Check if already in active chat
    const currentQueue = await prisma.matchingQueue.findUnique({
      where: { userId: user.id },
      select: { status: true, partnerUserId: true },
    });

    if (currentQueue?.status === "MATCHED" && currentQueue.partnerUserId) {
      await ctx.reply(
        "💬 <b>You are already in an active chat!</b>\n\n" +
          "• Use /next to find someone new\n" +
          "• Use /stop or /end to stop current chat",
        { parse_mode: "HTML" }
      );
      return;
    }

    if (currentQueue?.status === "WAITING") {
      await ctx.reply(
        "⏳ <b>Already Searching!</b>\n\n" +
          "We are looking for someone for you. Please wait a moment...\n\n" +
          "Use /stop or /cancel to stop searching.",
        {
          parse_mode: "HTML",
          reply_markup: getWaitingPartnerKeyboard(),
        }
      );
      return;
    }

    // Add to queue and find match
    await prisma.matchingQueue.upsert({
      where: { userId: user.id },
      update: { status: "WAITING", partnerUserId: null, joinedAt: new Date() },
      create: { userId: user.id, status: "WAITING", partnerUserId: null },
    });

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
        } catch (err) {
          console.error("Failed to notify partner on match:", err);
        }
      }

      await ctx.reply(connectedMessage.text, {
        parse_mode: "HTML",
        reply_markup: connectedMessage.reply_markup,
      });
    } else {
      await showWaitingForPartner(ctx);
    }
  } catch (err) {
    console.error("Search command error:", err);
    await ctx.reply("❌ Error searching for a partner. Please try again.");
  }
}

// ==========================================
// 2. /link — Send Telegram profile URL to partner
// ==========================================
export async function handleLink(ctx: any) {
  try {
    const telegramUserId = BigInt(ctx.from.id);
    const user = await prisma.user.findUnique({ where: { telegramUserId } });
    if (!user) {
      await ctx.reply("👋 Please use /start first to set up your profile.");
      return;
    }

    const queueEntry = await prisma.matchingQueue.findUnique({
      where: { userId: user.id },
      select: { status: true, partnerUserId: true },
    });

    if (queueEntry?.status !== "MATCHED" || !queueEntry.partnerUserId) {
      await ctx.reply(
        "💬 <b>You are not in an active chat right now!</b>\n\n" +
          "Find a partner first with /search to share your profile link.",
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔎 Find Someone", callback_data: "menu_find" }],
            ],
          },
        }
      );
      return;
    }

    const partner = await prisma.user.findUnique({
      where: { id: queueEntry.partnerUserId },
      select: { telegramUserId: true },
    });

    if (!partner) {
      await ctx.reply("❌ Your chat partner is no longer available.");
      return;
    }

    const username = ctx.from?.username;
    const firstName = ctx.from?.first_name || "Partner";
    const senderId = ctx.from?.id;

    if (username) {
      const linkMsg =
        `🔗 <b>Your partner shared their Telegram profile:</b>\n\n` +
        `👤 <b>Name:</b> ${firstName}\n` +
        `🏷️ <b>Username:</b> @${username}\n` +
        `🌐 <b>Profile Link:</b> https://t.me/${username}\n\n` +
        `<i>(Remember to stay safe and never send money or sensitive details to strangers.)</i>`;

      try {
        await ctx.telegram.sendMessage(
          Number(partner.telegramUserId),
          linkMsg,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "👤 Open Profile", url: `https://t.me/${username}` }],
              ],
            },
          }
        );
      } catch (err) {
        console.error("Failed to deliver profile link to partner:", err);
      }

      await ctx.reply(
        `✅ <b>Profile link sent to your partner!</b>\n\n` +
          `They received your profile: https://t.me/${username}`,
        { parse_mode: "HTML" }
      );
    } else {
      const linkMsg =
        `🔗 <b>Your partner shared their Telegram profile:</b>\n\n` +
        `👤 <b>Name:</b> ${firstName}\n` +
        `🆔 <b>User ID:</b> <code>${senderId}</code>\n\n` +
        `👉 <a href="tg://user?id=${senderId}">Tap here to message ${firstName}</a>\n\n` +
        `<i>(Remember to stay safe and never send money or sensitive details to strangers.)</i>`;

      try {
        await ctx.telegram.sendMessage(
          Number(partner.telegramUserId),
          linkMsg,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: `👤 Open ${firstName}'s Profile`, url: `tg://user?id=${senderId}` }],
              ],
            },
          }
        );
      } catch (err) {
        console.error("Failed to deliver profile link to partner:", err);
      }

      await ctx.reply(
        `✅ <b>Profile link sent to your partner!</b>\n\n` +
          `They received a direct link to your Telegram profile.`,
        { parse_mode: "HTML" }
      );
    }
  } catch (err) {
    console.error("Link error:", err);
    await ctx.reply("❌ Could not share link. Please try again.");
  }
}

// ==========================================
// 3. /reopen — Reopen past conversations
// ==========================================
export async function handleReopen(ctx: any) {
  try {
    const telegramUserId = BigInt(ctx.from.id);
    const user = await prisma.user.findUnique({ where: { telegramUserId } });
    if (!user) {
      await ctx.reply("👋 Please use /start first to set up your profile.");
      return;
    }

    const previous = await prisma.previousPartner.findMany({
      where: {
        OR: [
          { userOneId: user.id },
          { userTwoId: user.id },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: {
        userOne: {
          select: { id: true, firstName: true, gender: true, isBanned: true },
        },
        userTwo: {
          select: { id: true, firstName: true, gender: true, isBanned: true },
        },
      },
    });

    const activePartners = previous
      .map((p) => {
        const partner = p.userOneId === user.id ? p.userTwo : p.userOne;
        return {
          partner,
          nickname: p.nickname,
          updatedAt: p.updatedAt,
        };
      })
      .filter((item) => item.partner && !item.partner.isBanned);

    if (activePartners.length === 0) {
      await ctx.reply(
        "🔄 <b>Reopen Past Conversations</b>\n\n" +
          "You don't have any saved previous partners yet.\n" +
          "When you chat with someone, they will appear here so you can reconnect anytime!",
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔎 Find Someone Now", callback_data: "menu_find" }],
              [{ text: "⬅️ Main Menu", callback_data: "back_main_menu" }],
            ],
          },
        }
      );
      return;
    }

    const buttons = activePartners.map((item) => {
      const displayName = item.nickname
        ? `🏷️ ${item.nickname} (${item.partner.gender || "User"})`
        : `👤 ${item.partner.firstName || "Partner"} (${item.partner.gender || "User"})`;
      return [
        {
          text: `🔄 Reconnect with ${displayName}`,
          callback_data: `reconnect_user_${item.partner.id}`,
        },
      ];
    });

    buttons.push([{ text: "⬅️ Back to Menu", callback_data: "back_main_menu" }]);

    await ctx.reply(
      "🔄 <b>Reopen Past Conversations</b>\n\n" +
        "Choose a partner below to send a reconnection request:",
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttons },
      }
    );
  } catch (err) {
    console.error("Reopen error:", err);
    await ctx.reply("❌ Error loading previous partners. Please try again.");
  }
}

// ==========================================
// 4. /cancel — Cancel current operation
// ==========================================
export async function handleCancel(ctx: any) {
  try {
    const telegramUserId = BigInt(ctx.from.id);
    const user = await prisma.user.findUnique({
      where: { telegramUserId },
      select: { id: true },
    });

    if (!user) {
      await ctx.reply("🗑️ Nothing to cancel. Use /start to get started.");
      return;
    }

    // 1. Reset save partner nickname state
    await prisma.user.updateMany({
      where: { id: user.id },
      data: { savePartnerState: "NONE" },
    });

    // 2. Cancel pending reconnect requests
    await cancelPendingReconnectRequests(user.id);

    // 3. Check matching queue status
    const queue = await prisma.matchingQueue.findUnique({
      where: { userId: user.id },
      select: { status: true, partnerUserId: true },
    });

    if (queue?.status === "WAITING") {
      await prisma.matchingQueue.update({
        where: { userId: user.id },
        data: { status: "ENDED", partnerUserId: null },
      });

      await ctx.reply(
        "🗑️ <b>Search Cancelled</b>\n\nYou have left the matching queue.",
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

    if (queue?.status === "MATCHED" && queue.partnerUserId) {
      await ctx.reply(
        "ℹ️ <b>Active Chat in Progress</b>\n\nTo end this conversation, please use /stop or /end.",
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🛑 End Chat", callback_data: "btn_stop_chat" }],
            ],
          },
        }
      );
      return;
    }

    await ctx.reply("🗑️ <b>Operation cancelled.</b> All active actions have been reset.", {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔎 Find Someone", callback_data: "menu_find" }],
          [{ text: "⬅️ Main Menu", callback_data: "back_main_menu" }],
        ],
      },
    });
  } catch (err) {
    console.error("Cancel error:", err);
    await ctx.reply("❌ Error cancelling operation.");
  }
}

// ==========================================
// 5. /refer, /reference, /referral — Refer friends
// ==========================================
export async function handleRefer(ctx: any) {
  try {
    const telegramUserId = BigInt(ctx.from.id);
    let user = await prisma.user.findUnique({
      where: { telegramUserId },
      select: { id: true, referralCode: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramUserId,
          username: ctx.from.username ?? null,
          firstName: ctx.from.first_name || "User",
          lastName: ctx.from.last_name ?? null,
          referralCode: `TB${ctx.from.id}`,
          gender: "",
        },
        select: { id: true, referralCode: true },
      });
    }

    let refCode = user.referralCode;
    if (!refCode) {
      refCode = `TB${ctx.from.id}`;
      await prisma.user.update({
        where: { id: user.id },
        data: { referralCode: refCode },
      });
    }

    let botUsername = ctx.botInfo?.username;
    if (!botUsername) {
      try {
        const me = await ctx.telegram.getMe();
        botUsername = me.username;
      } catch {
        botUsername = process.env.TELEGRAM_BOT_USERNAME || "TalkBuddyGlobalBot";
      }
    }

    const referralLink = `https://t.me/${botUsername}?start=ref_${refCode}`;

    const count = await prisma.user.count({
      where: { referredById: user.id },
    });

    await ctx.reply(
      `🧑‍🤝‍🧑 <b>Refer Friends to TalkBuddy!</b>\n\n` +
        `Share your personal referral link with friends. Chat anonymously and make new connections together!\n\n` +
        `📊 <b>Your Total Referrals:</b> ${count} Friends joined\n\n` +
        `🔗 <b>Your Referral Link:</b>\n<code>${referralLink}</code>`,
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
            [{ text: "⬅️ Main Menu", callback_data: "back_main_menu" }],
          ],
        },
      }
    );
  } catch (err) {
    console.error("Refer error:", err);
    await ctx.reply("❌ Error loading referral information.");
  }
}

// ==========================================
// 6. /about — Help, rules, and terms
// ==========================================
export async function handleAbout(ctx: any) {
  try {
    await ctx.reply(
      `🤖 <b>About TalkBuddy Anonymous Chat</b>\n\n` +
        `TalkBuddy connects people globally for safe, anonymous 1-on-1 conversations.\n\n` +
        `🛡️ <b>Community Guidelines:</b>\n` +
        `• Be kind and respectful to all partners\n` +
        `• No harassment, hate speech, or explicit spam\n` +
        `• Never share sensitive credentials or financial details\n` +
        `• Use /report anytime to flag abusive behavior\n\n` +
        `👑 <b>VIP Privileges:</b>\n` +
        `• Gender Filter (/settings)\n` +
        `• Priority Queue Matching\n` +
        `• Unlimited Conversations\n` +
        `• Remote Message Wipe (/delete)\n\n` +
        `Enjoy making meaningful connections!`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "👑 VIP Plans", callback_data: "vip_info" }],
            [{ text: "⬅️ Main Menu", callback_data: "back_main_menu" }],
          ],
        },
      }
    );
  } catch (err) {
    console.error("About error:", err);
  }
}

// ==========================================
// 7. /myid — View Telegram ID & Profile Summary
// ==========================================
export async function handleMyId(ctx: any) {
  try {
    const telegramUserId = BigInt(ctx.from.id);
    let user = await prisma.user.findUnique({ where: { telegramUserId } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramUserId,
          username: ctx.from.username ?? null,
          firstName: ctx.from.first_name || "User",
          lastName: ctx.from.last_name ?? null,
          referralCode: `TB${ctx.from.id}`,
          gender: "",
        },
      });
    }

    const vipInfo = await getUserVipStatus(user.id);

    await ctx.reply(
      `🆔 <b>Your TalkBuddy Account ID</b>\n\n` +
        `• <b>Telegram User ID:</b> <code>${ctx.from.id}</code>\n` +
        `• <b>Name:</b> ${user.firstName} ${user.lastName || ""}\n` +
        `• <b>Username:</b> ${user.username ? "@" + user.username : ctx.from.username ? "@" + ctx.from.username : "None"}\n` +
        `• <b>Gender:</b> ${user.gender || "Not set"}\n` +
        `• <b>Age:</b> ${user.age ? `${user.age} yrs` : "Not set"}\n` +
        `• <b>Country:</b> ${user.country ?? "Not set"}\n` +
        `• <b>Profile Status:</b> ${user.isProfileComplete ? "✅ Complete & Verified" : "⚠️ Incomplete"}\n` +
        `• <b>VIP Status:</b> ${
          vipInfo.isVip
            ? `👑 Active (Expires: ${
                vipInfo.vipExpiresAt
                  ? new Date(vipInfo.vipExpiresAt).toLocaleDateString()
                  : "Active"
              })`
            : "Free Plan"
        }\n\n` +
        `Manage your profile and preferences in /settings!`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "⚙️ Open Settings", callback_data: "menu_settings" }],
            [{ text: "⬅️ Main Menu", callback_data: "back_main_menu" }],
          ],
        },
      }
    );
  } catch (err) {
    console.error("Myid error:", err);
    await ctx.reply("❌ Error loading your account ID.");
  }
}

// ==========================================
// 8. /profile — User Profile & Points Overview
// ==========================================
export async function showUserProfile(ctx: any) {
  try {
    const rawId = ctx.from?.id;
    if (!rawId) return;

    const telegramUserId = BigInt(rawId);
    const user = await prisma.user.findUnique({
      where: { telegramUserId },
    });

    if (!user) {
      const text =
        "👤 <b>My Profile</b>\n\n" +
        "⚠️ Your profile has not been created yet.\n" +
        "Please select your gender or use /start to begin.";
      const markup = {
        inline_keyboard: [
          [{ text: "👤 Select Gender", callback_data: "select_gender" }],
          [{ text: "⬅️ Back to Menu", callback_data: "back_main_menu" }],
        ],
      };
      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: markup });
      } else {
        await ctx.reply(text, { parse_mode: "HTML", reply_markup: markup });
      }
      return;
    }

    let pointsBalance = user.pointsBalance;
    let isVip = user.isVip;
    let vipExpiresAt = user.vipExpiresAt;

    try {
      const vipInfo = await getUserVipStatus(user.id);
      if (vipInfo) {
        pointsBalance = vipInfo.pointsBalance ?? user.pointsBalance;
        isVip = vipInfo.isVip ?? user.isVip;
        vipExpiresAt = vipInfo.vipExpiresAt ?? user.vipExpiresAt;
      }
    } catch {}

    const profileComplete = Boolean(
      user.gender && user.country && user.age && user.age >= 18
    );

    const vipText = isVip
      ? `👑 Active (${vipExpiresAt ? `Expires: ${new Date(vipExpiresAt).toLocaleDateString()}` : "Permanent"})`
      : "Free Plan";

    const text =
      "👤 <b>My Profile & Account Status</b>\n\n" +
      `• <b>Name:</b> ${escapeHtml(user.firstName || "User")} ${escapeHtml(user.lastName || "")}\n` +
      `• <b>Username:</b> ${user.username ? `@${escapeHtml(user.username)}` : "Not set"}\n` +
      `• <b>Telegram ID:</b> <code>${rawId}</code>\n\n` +
      `👑 <b>VIP Membership:</b> <b>${vipText}</b>\n\n` +
      `• <b>Gender:</b> ${user.gender || "Not set"}\n` +
      `• <b>Age:</b> ${user.age ? `${user.age} Years` : "⚠️ Not set"}\n` +
      `• <b>Country:</b> ${user.country ? escapeHtml(user.country) : "⚠️ Not set"}\n` +
      `• <b>Verification:</b> ${
        profileComplete ? "✅ Verified" : "⚠️ Incomplete"
      }\n\n` +
      "🔒 Your Telegram identity is never shared automatically with your chat partner.";

    const markup = {
      inline_keyboard: [
        [
          { text: "👑 VIP Plans (⭐ Stars)", callback_data: "vip_info" },
        ],
        [
          {
            text: "⚙️ Settings & Verification",
            callback_data: "menu_settings",
          },
          {
            text: "⬅️ Back to Menu",
            callback_data: "back_main_menu",
          },
        ],
      ],
    };

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, {
          parse_mode: "HTML",
          reply_markup: markup,
        });
      } catch (err: any) {
        if (!err?.message?.includes("message is not modified")) {
          await ctx.reply(text, { parse_mode: "HTML", reply_markup: markup });
        }
      }
    } else {
      await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: markup,
      });
    }
  } catch (error) {
    console.error("Failed to show user profile:", error);
    await ctx.reply("❌ Error loading your profile. Please try /profile again.");
  }
}

// ==========================================
// 9. /settings & /setting — User Settings & Verification
// ==========================================
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function renderSettingsMenu(ctx: any) {
  try {
    const rawId = ctx.from?.id;
    if (!rawId) {
      return;
    }
    const telegramUserId = BigInt(rawId);
    const user = await getUserSettings(telegramUserId);

    if (!user) {
      await ctx.reply("👋 Please use /start first.");
      return;
    }

    const vipStatus = await getUserVipStatus(user.id);
    const isVip = vipStatus.isVip;
    const pointsBalance = vipStatus.pointsBalance ?? user.pointsBalance;
    const setting = user.setting;

    const profileComplete = Boolean(
      user.gender && user.country && user.age && user.age >= 18
    );

    // Auto-sync profile complete status if all fields are populated
    if (profileComplete && !user.isProfileComplete) {
      await saveUserSetting(telegramUserId, {
        gender: user.gender,
        country: user.country || undefined,
        age: user.age || undefined,
      });
    }

    let filterText = "";
    if (isVip) {
      if (profileComplete) {
        const activeGender = escapeHtml(setting?.genderFilterPreference || user.genderFilterPreference || "ANY");
        const activeCountry = escapeHtml(setting?.countryFilterPreference || user.countryFilterPreference || "ANY");
        filterText =
          `🎯 <b>Active Gender Filter:</b> <b>${activeGender}</b>\n` +
          `🌍 <b>Active Country Filter:</b> <b>${activeCountry}</b>\n` +
          `<i>(Matchmaking prioritizes your selected filters)</i>\n`;
      } else {
        filterText =
          `⚠️ <b>VIP Filters Locked:</b> Complete Age &amp; Country verification below to unlock.\n`;
      }
    } else {
      filterText =
        `🔒 <b>VIP Filters Locked:</b> Requires active VIP. Upgrade via /vip to unlock!\n`;
    }

    const notifStatus = setting?.notificationsEnabled !== false ? "🔔 Enabled" : "🔕 Muted";
    const userGender = escapeHtml(user.gender || "Not set");
    const userCountry = escapeHtml(user.country || "⚠️ Not set");

    const text =
      `⚙️ <b>TalkBuddy User Settings &amp; Verification</b>\n\n` +
      `👑 <b>VIP Status:</b> <b>${isVip ? "ACTIVE" : "Free Plan"}</b>\n\n` +
      `👤 <b>Profile Details:</b>\n` +
      `• <b>Gender:</b> ${userGender}\n` +
      `• <b>Age:</b> ${user.age ? `${user.age} Years` : "⚠️ Not set"}\n` +
      `• <b>Country:</b> ${userCountry}\n` +
      `• <b>Verification:</b> ${
        profileComplete ? "✅ Complete &amp; Verified" : "⚠️ Incomplete"
      }\n` +
      `• <b>Notifications:</b> ${notifStatus}\n\n` +
      `👑 <b>VIP Perks Status:</b>\n` +
      filterText +
      `\nChoose a setting below to customize:`;

    const keyboard: any[] = [];

    // If user is VIP, show the dedicated VIP Gender Filter Menu button
    if (isVip) {
      keyboard.push([
        { text: "🎯 VIP Gender Filter Menu", callback_data: "vip_filter_select" },
      ]);
    }

    // Quick Filter selection buttons if profile is complete
    if (isVip && profileComplete) {
      keyboard.push([
        { text: "🎯 Filter: 👨 Male", callback_data: "set_filter_Male" },
        { text: "🎯 Filter: 👩 Female", callback_data: "set_filter_Female" },
      ]);
      keyboard.push([
        { text: "🎯 Filter: 🏳️‍⚧️ Trans", callback_data: "set_filter_Trans Man" },
        { text: "🎯 Filter: 🔄 Any Gender", callback_data: "set_filter_ANY" },
      ]);
      keyboard.push([
        { text: "🌍 Country Filter", callback_data: "setup_filter_country" },
      ]);
    }

    // Profile edit buttons
    keyboard.push([
      { text: "👤 Change Gender", callback_data: "setup_gender" },
      { text: "🎂 Set Age", callback_data: "setup_age" },
    ]);
    keyboard.push([
      { text: "🌍 Set Country", callback_data: "setup_country" },
      {
        text: setting?.notificationsEnabled !== false ? "🔕 Mute Notifs" : "🔔 Unmute Notifs",
        callback_data: "toggle_notifications",
      },
    ]);
    keyboard.push([
      { text: "👑 VIP Plans", callback_data: "vip_info" },
      { text: "⬅️ Back to Menu", callback_data: "back_main_menu" },
    ]);

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: keyboard },
        });
      } catch (editErr: any) {
        const errMsg = editErr?.description || editErr?.message || "";
        if (errMsg.includes("message is not modified")) {
          return;
        }
        await ctx.reply(text, {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: keyboard },
        });
      }
    } else {
      await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: keyboard },
      });
    }
  } catch (err) {
    console.error("Settings error:", err);
    try {
      await ctx.reply("❌ Error opening settings. Please try /settings again.");
    } catch {}
  }
}

// ==========================================
// 9. /truth — Send Truth question in active chat
// ==========================================
export async function handleTruth(ctx: any) {
  try {
    const question =
      TRUTH_QUESTIONS[Math.floor(Math.random() * TRUTH_QUESTIONS.length)];

    const telegramUserId = BigInt(ctx.from.id);
    const user = await prisma.user.findUnique({ where: { telegramUserId } });
    if (!user) return;

    const queueEntry = await prisma.matchingQueue.findUnique({
      where: { userId: user.id },
      select: { status: true, partnerUserId: true },
    });

    const truthText = `🧐 <b>Truth Question:</b>\n\n<i>"${question}"</i>`;

    if (queueEntry?.status === "MATCHED" && queueEntry.partnerUserId) {
      const partner = await prisma.user.findUnique({
        where: { id: queueEntry.partnerUserId },
        select: { telegramUserId: true },
      });

      const keyboard = {
        inline_keyboard: [[{ text: "🎲 Next Truth", callback_data: "game_truth_next" }]],
      };

      await ctx.reply(truthText, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });

      if (partner) {
        try {
          await ctx.telegram.sendMessage(
            Number(partner.telegramUserId),
            `🎲 <b>Your partner requested a Truth Question:</b>\n\n${truthText}`,
            {
              parse_mode: "HTML",
              reply_markup: keyboard,
            }
          );
        } catch {}
      }
    } else {
      await ctx.reply(
        `${truthText}\n\n<i>(Connect with someone using /search to play Truth or Dare together!)</i>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🎲 Next Truth", callback_data: "game_truth_next" }],
              [{ text: "🔎 Find Partner", callback_data: "menu_find" }],
            ],
          },
        }
      );
    }
  } catch (err) {
    console.error("Truth error:", err);
  }
}

// ==========================================
// 10. /dare — Send Dare challenge in active chat
// ==========================================
export async function handleDare(ctx: any) {
  try {
    const challenge =
      DARE_CHALLENGES[Math.floor(Math.random() * DARE_CHALLENGES.length)];

    const telegramUserId = BigInt(ctx.from.id);
    const user = await prisma.user.findUnique({ where: { telegramUserId } });
    if (!user) return;

    const queueEntry = await prisma.matchingQueue.findUnique({
      where: { userId: user.id },
      select: { status: true, partnerUserId: true },
    });

    const dareText = `🎲 <b>Dare Challenge:</b>\n\n<i>"${challenge}"</i>`;

    if (queueEntry?.status === "MATCHED" && queueEntry.partnerUserId) {
      const partner = await prisma.user.findUnique({
        where: { id: queueEntry.partnerUserId },
        select: { telegramUserId: true },
      });

      const keyboard = {
        inline_keyboard: [[{ text: "🎲 Next Dare", callback_data: "game_dare_next" }]],
      };

      await ctx.reply(dareText, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });

      if (partner) {
        try {
          await ctx.telegram.sendMessage(
            Number(partner.telegramUserId),
            `🎲 <b>Your partner sent a Dare Challenge:</b>\n\n${dareText}`,
            {
              parse_mode: "HTML",
              reply_markup: keyboard,
            }
          );
        } catch {}
      }
    } else {
      await ctx.reply(
        `${dareText}\n\n<i>(Connect with someone using /search to play Dare challenges together!)</i>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🎲 Next Dare", callback_data: "game_dare_next" }],
              [{ text: "🔎 Find Partner", callback_data: "menu_find" }],
            ],
          },
        }
      );
    }
  } catch (err) {
    console.error("Dare error:", err);
  }
}

// ==========================================
// 11. /translate — Live message translation
// ==========================================
export async function handleTranslate(ctx: any) {
  try {
    const replied = (ctx.message as any)?.reply_to_message;
    const textArg = ctx.message?.text?.split(" ").slice(1).join(" ").trim();
    const textToTranslate = replied?.text || textArg;

    if (!textToTranslate) {
      await ctx.reply(
        "🌐 <b>TalkBuddy Live Translation:</b>\n\n" +
          "• Reply to any message and type <code>/translate</code>\n" +
          "• Or type <code>/translate your message here</code> to translate it into English!",
        { parse_mode: "HTML" }
      );
      return;
    }

    const result = await translateText(textToTranslate, "en");
    if (result) {
      await ctx.reply(
        `🌐 <b>Live Translation:</b>\n\n` +
          `📝 <b>Original:</b> <i>"${textToTranslate}"</i>\n\n` +
          `🇬🇧 <b>Translation:</b>\n<b>"${result.translatedText}"</b>`,
        { parse_mode: "HTML" }
      );
    } else {
      await ctx.reply(
        `🌐 <b>Original:</b> <i>"${textToTranslate}"</i>\n\n` +
          `✨ All languages are welcome on TalkBuddy. Continue your chat!`,
        { parse_mode: "HTML" }
      );
    }
  } catch (err) {
    console.error("Translate error:", err);
  }
}

// ==========================================
// 12. /promocode — Promo code redemption
// ==========================================
export async function handlePromocode(ctx: any) {
  try {
    const args = ctx.message?.text?.split(" ").slice(1) || [];
    const codeArg = args[0];

    const telegramUserId = BigInt(ctx.from.id);
    const user = await prisma.user.findUnique({ where: { telegramUserId } });
    if (!user) return;

    if (codeArg) {
      const result = await redeemPromoCode(user.id, codeArg);
      if (result.success) {
        await ctx.reply(
          `🎉 <b>Promo Code Redeemed!</b>\n\n` +
            `🎁 <b>Points Added:</b> +${result.pointsReward} Points\n` +
            `💎 <b>New Balance:</b> <b>${result.newPointsBalance} Points</b>\n` +
            (result.vipDaysReward
              ? `👑 <b>VIP Access:</b> +${result.vipDaysReward} Days Granted!\n`
              : "") +
            `\nEnjoy chatting on TalkBuddy!`,
          { parse_mode: "HTML" }
        );
      } else if (result.reason === "ALREADY_REDEEMED") {
        await ctx.reply("⚠️ You have already redeemed this promo code.");
      } else {
        await ctx.reply("❌ Invalid or expired promo code.");
      }
      return;
    }

    // Show interactive promo code options
    await ctx.reply(
      `🎟️ <b>Redeem Promo Code</b>\n\n` +
        `Use special promo codes for free bonus Points and VIP memberships!\n\n` +
        `You can type: <code>/promocode YOUR_CODE</code>\n` +
        `Or click an active promo code below:`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎁 Claim 'TALKBUDDY' (+100 pts)", callback_data: "promo_code_TALKBUDDY" }],
            [{ text: "👑 Claim 'VIPFREE' (3d VIP Pass)", callback_data: "promo_code_VIPFREE" }],
            [{ text: "💎 Claim 'PREMIUM2026' (+150 pts & VIP)", callback_data: "promo_code_PREMIUM2026" }],
            [{ text: "⬅️ Back to Menu", callback_data: "back_main_menu" }],
          ],
        },
      }
    );
  } catch (err) {
    console.error("Promocode error:", err);
  }
}

// ==========================================
// 13. /paysupport — Payment support
// ==========================================
export async function handlePaySupport(ctx: any) {
  await ctx.reply(
    `💰 <b>TalkBuddy Payment Support</b>\n\n` +
      `TalkBuddy uses <b>Telegram Stars (⭐)</b> for fast, secure payments natively inside Telegram.\n\n` +
      `✨ <b>How to purchase Points & VIP:</b>\n` +
      `1. Open <code>/vip</code> or <code>/earn</code>\n` +
      `2. Tap <b>Buy Points Packages</b>\n` +
      `3. Complete checkout using Telegram Stars\n\n` +
      `❓ <b>Need payment assistance?</b>\n` +
      `Provide your Telegram User ID (<code>${ctx.from.id}</code>) to TalkBuddy Admin for quick resolution.`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "💳 Buy Points", callback_data: "earn_buy_points" }],
          [{ text: "👑 VIP Plans", callback_data: "vip_info" }],
          [{ text: "⬅️ Main Menu", callback_data: "back_main_menu" }],
        ],
      },
    }
  );
}

// ==========================================
// Register all Feature Handlers in Telegraf
// ==========================================
export function registerFeatureHandlers(bot: Telegraf) {
  // Command handlers
  bot.command("search", handleSearch);
  bot.command("stop", handleEnd);
  bot.command("link", handleLink);
  bot.command("reopen", handleReopen);
  bot.command("truth", handleTruth);
  bot.command("dare", handleDare);
  bot.command("translate", handleTranslate);
  bot.command("promocode", handlePromocode);
  bot.command("about", handleAbout);
  bot.command("myid", handleMyId);
  bot.command("id", handleMyId);
  bot.command("paysupport", handlePaySupport);
  bot.command("refer", handleRefer);
  bot.command("reference", handleRefer);
  bot.command("referral", handleRefer);
  bot.command("cancel", handleCancel);
  bot.command("premium", showVipMenu);
  bot.command("settings", renderSettingsMenu);
  bot.command("setting", renderSettingsMenu);
  bot.command("profile", showUserProfile);
  bot.command("me", showUserProfile);
  bot.command("account", showUserProfile);
  bot.command("menu", showMainMenu);
  bot.command("mainmenu", showMainMenu);

  // Truth & Dare Next callbacks
  bot.action("game_truth_next", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const question =
        TRUTH_QUESTIONS[Math.floor(Math.random() * TRUTH_QUESTIONS.length)];
      const truthText = `🧐 <b>Truth Question:</b>\n\n<i>"${question}"</i>`;
      await ctx.reply(truthText, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "🎲 Next Truth", callback_data: "game_truth_next" }]],
        },
      });
    } catch {}
  });

  bot.action("game_dare_next", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const challenge =
        DARE_CHALLENGES[Math.floor(Math.random() * DARE_CHALLENGES.length)];
      const dareText = `🎲 <b>Dare Challenge:</b>\n\n<i>"${challenge}"</i>`;
      await ctx.reply(dareText, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "🎲 Next Dare", callback_data: "game_dare_next" }]],
        },
      });
    } catch {}
  });

  // Reopen reconnect callback
  bot.action(/^reconnect_user_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const partnerId = ctx.match[1];
      const telegramUserId = BigInt(ctx.from.id);
      const user = await prisma.user.findUnique({ where: { telegramUserId } });
      if (!user) return;

      const activeQueue = await prisma.matchingQueue.findUnique({
        where: { userId: user.id },
        select: { status: true, partnerUserId: true },
      });

      if (activeQueue?.status === "MATCHED" && activeQueue.partnerUserId) {
        await ctx.reply(
          "💬 <b>You are already in an active chat!</b>\n\nUse /stop first before reconnecting with another partner.",
          { parse_mode: "HTML" }
        );
        return;
      }

      const request = await createReconnectRequest(user.id, partnerId);
      if (!request) {
        await ctx.reply("❌ You cannot reconnect with this user right now.");
        return;
      }

      const receiver = await prisma.user.findUnique({
        where: { id: partnerId },
        select: { telegramUserId: true, firstName: true },
      });

      if (receiver) {
        try {
          await ctx.telegram.sendMessage(
            Number(receiver.telegramUserId),
            `🔄 <b>Reconnect Request</b>\n\n` +
              `Your previous partner <b>${user.firstName}</b> wants to chat again!\n\n` +
              `Would you like to reconnect?`,
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "✅ Accept",
                      callback_data: `reconnect_accept_${request.id}`,
                    },
                    {
                      text: "❌ Decline",
                      callback_data: `reconnect_decline_${request.id}`,
                    },
                  ],
                ],
              },
            }
          );
        } catch (err) {
          console.error("Failed to notify receiver:", err);
        }
      }

      await ctx.reply(
        "📨 <b>Reconnect request sent!</b>\n\n" +
          "Your previous partner has been notified.\n" +
          "Waiting for their response.",
        { parse_mode: "HTML" }
      );
    } catch (err) {
      console.error("Reconnect user error:", err);
    }
  });

  // Promocode callback
  bot.action(/^promo_code_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const code = ctx.match[1];
      const telegramUserId = BigInt(ctx.from.id);
      const user = await prisma.user.findUnique({ where: { telegramUserId } });
      if (!user) return;

      const result = await redeemPromoCode(user.id, code);
      if (result.success) {
        await ctx.editMessageText(
          `🎉 <b>Promo Code '${code}' Redeemed!</b>\n\n` +
            `🎁 <b>Points Added:</b> +${result.pointsReward} Points\n` +
            `💎 <b>New Balance:</b> <b>${result.newPointsBalance} Points</b>\n` +
            (result.vipDaysReward
              ? `👑 <b>VIP Access:</b> +${result.vipDaysReward} Days Granted!\n`
              : "") +
            `\nEnjoy your perks on TalkBuddy!`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "👑 View VIP & Settings", callback_data: "vip_info" }],
                [{ text: "🔎 Find Someone", callback_data: "menu_find" }],
              ],
            },
          }
        );
      } else if (result.reason === "ALREADY_REDEEMED") {
        await ctx.editMessageText(
          `⚠️ <b>Promo Code '${code}' Already Used</b>\n\n` +
            `You have already claimed this promo code once. Stay tuned for future promotions!`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[{ text: "⬅️ Back to Menu", callback_data: "back_main_menu" }]],
            },
          }
        );
      } else {
        await ctx.editMessageText(`❌ Promo code '${code}' is invalid or expired.`, {
          reply_markup: {
            inline_keyboard: [[{ text: "⬅️ Back to Menu", callback_data: "back_main_menu" }]],
          },
        });
      }
    } catch (err) {
      console.error("Promo callback error:", err);
    }
  });

  // Settings callbacks
  bot.action("menu_settings", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch {}
    await renderSettingsMenu(ctx);
  });

  bot.action("settings_profile", async (ctx) => {
    try {
      await ctx.answerCbQuery();
    } catch {}
    await renderSettingsMenu(ctx);
  });

  // Handle setting gender filter
  bot.action(/^set_filter_(Male|Female|Trans Man|Trans Woman|Non-binary|ANY)$/, async (ctx) => {
    try {
      const preference = ctx.match[1];
      const rawId = ctx.from?.id;
      if (!rawId) {
        await ctx.answerCbQuery();
        return;
      }
      const telegramUserId = BigInt(rawId);

      const user = await prisma.user.findUnique({
        where: { telegramUserId },
      });

      if (!user) {
        await ctx.answerCbQuery();
        return;
      }

      const vipInfo = await getUserVipStatus(user.id);
      if (!vipInfo.isVip) {
        await ctx.answerCbQuery("🔒 Gender Filter requires VIP. Upgrade via /vip!", { show_alert: true });
        return;
      }

      if (!user.gender) {
        await ctx.answerCbQuery("⚠️ Please select your Gender first!", { show_alert: true });
        return;
      }

      await saveUserSetting(telegramUserId, {
        genderFilterPreference: preference,
      });

      await ctx.answerCbQuery(`✅ Gender Filter set to: ${preference}!`, { show_alert: true });
      await renderSettingsMenu(ctx);
    } catch (err) {
      console.error("Set filter error:", err);
      try {
        await ctx.answerCbQuery();
      } catch {}
    }
  });

  // Country Filter Setup
  bot.action("setup_filter_country", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const rawId = ctx.from?.id;
      if (!rawId) return;
      const telegramUserId = BigInt(rawId);
      const user = await prisma.user.findUnique({ where: { telegramUserId } });
      if (!user) return;

      const vipInfo = await getUserVipStatus(user.id);
      if (!vipInfo.isVip) {
        await ctx.reply("🔒 The Country Filter is an exclusive VIP perk. Upgrade via /vip to unlock!");
        return;
      }

      const text =
        `🌍 <b>Select Country Filter Preference:</b>\n\n` +
        `Match only with users from a specific country, or select 'ANY' for worldwide matching:`;
      const keyboard = [
        [
          { text: "🇱🇰 Sri Lanka", callback_data: "set_cfilter_Sri Lanka" },
          { text: "🇮🇳 India", callback_data: "set_cfilter_India" },
        ],
        [
          { text: "🇺🇸 United States", callback_data: "set_cfilter_United States" },
          { text: "🇬🇧 United Kingdom", callback_data: "set_cfilter_United Kingdom" },
        ],
        [
          { text: "🇦🇪 UAE / Gulf", callback_data: "set_cfilter_UAE" },
          { text: "🇨🇦 Canada", callback_data: "set_cfilter_Canada" },
        ],
        [
          { text: "🔄 ANY (Worldwide)", callback_data: "set_cfilter_ANY" },
        ],
        [{ text: "⬅️ Back to Settings", callback_data: "menu_settings" }],
      ];

      try {
        await ctx.editMessageText(text, {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: keyboard },
        });
      } catch {
        await ctx.reply(text, {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: keyboard },
        });
      }
    } catch (err) {
      console.error("Setup filter country error:", err);
    }
  });

  bot.action(/^set_cfilter_(.+)$/, async (ctx) => {
    try {
      const preference = ctx.match[1];
      const rawId = ctx.from?.id;
      if (!rawId) {
        await ctx.answerCbQuery();
        return;
      }
      const telegramUserId = BigInt(rawId);

      await saveUserSetting(telegramUserId, {
        countryFilterPreference: preference,
      });

      await ctx.answerCbQuery(`✅ Country Filter set to: ${preference}!`, { show_alert: true });
      await renderSettingsMenu(ctx);
    } catch (err) {
      console.error("Set country filter error:", err);
      try {
        await ctx.answerCbQuery();
      } catch {}
    }
  });

  // Notification toggle callback
  bot.action("toggle_notifications", async (ctx) => {
    try {
      const rawId = ctx.from?.id;
      if (!rawId) {
        await ctx.answerCbQuery();
        return;
      }
      const telegramUserId = BigInt(rawId);
      const userWithSetting = await getUserSettings(telegramUserId);
      if (!userWithSetting) {
        await ctx.answerCbQuery();
        return;
      }

      const current = userWithSetting.setting?.notificationsEnabled ?? true;
      const next = !current;

      await saveUserSetting(telegramUserId, {
        notificationsEnabled: next,
      });

      await ctx.answerCbQuery(next ? "🔔 Notifications enabled!" : "🔕 Notifications muted!", {
        show_alert: true,
      });
      await renderSettingsMenu(ctx);
    } catch (err) {
      console.error("Toggle notifications error:", err);
      try {
        await ctx.answerCbQuery();
      } catch {}
    }
  });

  // Handle Age selection
  bot.action("setup_age", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const text =
        `🎂 <b>Select Your Age:</b>\n\n` +
        `Age verification is required to unlock the VIP Gender Filter and maintain a safe platform. Select your age:`;
      const keyboard = [
        [
          { text: "18-21", callback_data: "save_age_20" },
          { text: "22-25", callback_data: "save_age_24" },
          { text: "26-30", callback_data: "save_age_28" },
        ],
        [
          { text: "31-35", callback_data: "save_age_33" },
          { text: "36-40", callback_data: "save_age_38" },
          { text: "40+", callback_data: "save_age_45" },
        ],
        [{ text: "⬅️ Back to Settings", callback_data: "menu_settings" }],
      ];

      try {
        await ctx.editMessageText(text, {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: keyboard },
        });
      } catch {
        await ctx.reply(text, {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: keyboard },
        });
      }
    } catch (err) {
      console.error("Age setup error:", err);
    }
  });

  bot.action(/^save_age_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const age = parseInt(ctx.match[1], 10);
      const rawId = ctx.from?.id;
      if (!rawId) return;
      const telegramUserId = BigInt(rawId);

      await saveUserSetting(telegramUserId, { age });
      await renderSettingsMenu(ctx);
    } catch (err) {
      console.error("Save age error:", err);
    }
  });

  // Handle Country selection
  bot.action("setup_country", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const text =
        `🌍 <b>Select Your Country:</b>\n\n` +
        `Country verification helps improve local and global partner matchmaking:`;
      const keyboard = [
        [
          { text: "🇱🇰 Sri Lanka", callback_data: "save_country_Sri Lanka" },
          { text: "🇮🇳 India", callback_data: "save_country_India" },
        ],
        [
          { text: "🇺🇸 United States", callback_data: "save_country_United States" },
          { text: "🇬🇧 United Kingdom", callback_data: "save_country_United Kingdom" },
        ],
        [
          { text: "🇦🇪 UAE / Gulf", callback_data: "save_country_UAE" },
          { text: "🇨🇦 Canada", callback_data: "save_country_Canada" },
        ],
        [
          { text: "🇦🇺 Australia", callback_data: "save_country_Australia" },
          { text: "🌍 Worldwide / Other", callback_data: "save_country_International" },
        ],
        [{ text: "⬅️ Back to Settings", callback_data: "menu_settings" }],
      ];

      try {
        await ctx.editMessageText(text, {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: keyboard },
        });
      } catch {
        await ctx.reply(text, {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: keyboard },
        });
      }
    } catch (err) {
      console.error("Country setup error:", err);
    }
  });

  bot.action(/^save_country_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const country = ctx.match[1];
      const rawId = ctx.from?.id;
      if (!rawId) return;
      const telegramUserId = BigInt(rawId);

      await saveUserSetting(telegramUserId, { country });
      await renderSettingsMenu(ctx);
    } catch (err) {
      console.error("Save country error:", err);
    }
  });

  // Handle Gender selection
  bot.action("setup_gender", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const text = `👤 <b>Select Your Gender:</b>`;
      const keyboard = [
        [
          { text: "👨 Male", callback_data: "save_gender_Male" },
          { text: "👩 Female", callback_data: "save_gender_Female" },
        ],
        [
          { text: "🏳️‍⚧️ Trans Man", callback_data: "save_gender_Trans Man" },
          { text: "🏳️‍⚧️ Trans Woman", callback_data: "save_gender_Trans Woman" },
        ],
        [{ text: "🧑 Non-binary", callback_data: "save_gender_Non-binary" }],
        [{ text: "⬅️ Back to Settings", callback_data: "menu_settings" }],
      ];

      try {
        await ctx.editMessageText(text, {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: keyboard },
        });
      } catch {
        await ctx.reply(text, {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: keyboard },
        });
      }
    } catch (err) {
      console.error("Gender setup error:", err);
    }
  });

  bot.action(/^save_gender_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const gender = ctx.match[1];
      const rawId = ctx.from?.id;
      if (!rawId) return;
      const telegramUserId = BigInt(rawId);

      await saveUserSetting(telegramUserId, { gender });
      await renderSettingsMenu(ctx);
    } catch (err) {
      console.error("Save gender error:", err);
    }
  });
}
