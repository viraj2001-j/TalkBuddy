import type { Context, Telegraf } from "telegraf";
import type { NarrowedContext } from "telegraf";
import type { Update } from "telegraf/types";

import prisma from "@/lib/db";
import { uploadToR2 } from "@/lib/r2";
import { getGenderKeyboard, getWaitingPartnerKeyboard } from "@/lib/telegram/menu";
import { SAVE_PARTNER_COST, spendPoints } from "@/lib/telegram/points";
import {
  clearSavePartnerState,
  validatePartnerNickname,
} from "@/lib/telegram/saved-partners";
import { getPreviousPartner } from "@/lib/telegram/previous-partners";
import { showMainMenu } from "@/lib/telegram/messages";
import { handleStart } from "@/lib/telegram/handlers/start";
import { handleNext } from "@/lib/telegram/handlers/next";
import { handleEnd } from "@/lib/telegram/handlers/end";
import { showVipMenu, showUserPurchaseHistory } from "@/lib/telegram/handlers/vip";
import { showEarnMenu } from "@/lib/telegram/handlers/earn";
import { handleReport } from "@/lib/telegram/handlers/report";
import {
  handleSearch,
  handleLink,
  handleReopen,
  renderSettingsMenu,
  showUserProfile,
  handleRefer,
  handleAbout,
  handleMyId,
  handleCancel,
  handleTruth,
  handleDare,
  handleTranslate,
  handlePromocode,
  handlePaySupport,
} from "@/lib/telegram/handlers/features";
import { handleGenderFilterCommand } from "@/lib/telegram/handlers/vip-onboarding";

/**
 * Intercepts slash commands and recognized command keywords
 * before anonymous message forwarding. Ensures commands never leak to the partner
 * and work reliably across all chat states, mobile capitalizations, and aliases.
 */
export async function routeCommandOrKeyword(ctx: any): Promise<boolean> {
  const message = ctx.message;
  if (!message || !("text" in message) || typeof message.text !== "string") {
    return false;
  }

  const rawText = message.text.trim();
  if (!rawText) return false;

  // 1. Slash commands (e.g. /search, /Search, /stop, /stop@TalkBuddyBot, /link, /setting, /reference, etc.)
  if (rawText.startsWith("/")) {
    const match = rawText.match(/^\/([a-zA-Z0-9_]+)(?:@\S+)?(?:\s+([\s\S]*))?$/);
    if (!match) return false;

    const cmd = match[1].toLowerCase();
    switch (cmd) {
      case "start":
        await handleStart(ctx);
        return true;
      case "next":
        await handleNext(ctx);
        return true;
      case "stop":
      case "end":
        await handleEnd(ctx);
        return true;
      case "search":
      case "find":
        await handleSearch(ctx);
        return true;
      case "link":
        await handleLink(ctx);
        return true;
      case "reopen":
        await handleReopen(ctx);
        return true;
      case "settings":
      case "setting":
        await renderSettingsMenu(ctx);
        return true;
      case "refer":
      case "reference":
      case "referral":
        await handleRefer(ctx);
        return true;
      case "about":
      case "help":
        await handleAbout(ctx);
        return true;
      case "myid":
      case "id":
        await handleMyId(ctx);
        return true;
      case "cancel":
        await handleCancel(ctx);
        return true;
      case "profile":
      case "me":
      case "account":
        await showUserProfile(ctx);
        return true;
      case "menu":
      case "mainmenu":
        await showMainMenu(ctx);
        return true;
      case "vip":
      case "premium":
        await showVipMenu(ctx);
        return true;
      case "filter":
      case "genderfilter":
      case "filters":
        await handleGenderFilterCommand(ctx);
        return true;
      case "history":
        await showUserPurchaseHistory(ctx);
        return true;
      case "earn":
      case "points":
      case "balance":
        await showEarnMenu(ctx);
        return true;
      case "truth":
        await handleTruth(ctx);
        return true;
      case "dare":
        await handleDare(ctx);
        return true;
      case "translate":
        await handleTranslate(ctx);
        return true;
      case "promocode":
        await handlePromocode(ctx);
        return true;
      case "paysupport":
        await handlePaySupport(ctx);
        return true;
      case "report":
        await handleReport(ctx);
        return true;
      default:
        // Prevent unrecognized slash commands from leaking into chat with partner
        await ctx.reply(
          `⚠️ Unknown command <code>/${cmd}</code>.\n\nUse /about or the bot menu to see available commands.`,
          { parse_mode: "HTML" }
        );
        return true;
    }
  }

  // 2. Exact keyword commands (case-insensitive, handles mobile keyboards and button texts)
  const normalized = rawText
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .trim();

  switch (normalized) {
    case "search":
    case "find":
    case "find someone":
      await handleSearch(ctx);
      return true;
    case "stop":
    case "end":
    case "stop chat":
    case "end chat":
      await handleEnd(ctx);
      return true;
    case "next":
      await handleNext(ctx);
      return true;
    case "link":
    case "share link":
      await handleLink(ctx);
      return true;
    case "reopen":
      await handleReopen(ctx);
      return true;
    case "setting":
    case "settings":
      await renderSettingsMenu(ctx);
      return true;
    case "reference":
    case "refer":
    case "referral":
      await handleRefer(ctx);
      return true;
    case "about":
    case "help":
      await handleAbout(ctx);
      return true;
    case "myid":
    case "my id":
    case "id":
      await handleMyId(ctx);
      return true;
    case "cancel":
      await handleCancel(ctx);
      return true;
    case "profile":
    case "my profile":
    case "my account":
      await showUserProfile(ctx);
      return true;
    case "menu":
    case "main menu":
      await showMainMenu(ctx);
      return true;
    case "vip":
    case "premium":
      await showVipMenu(ctx);
      return true;
    case "history":
    case "my history":
      await showUserPurchaseHistory(ctx);
      return true;
    case "earn":
    case "points":
    case "balance":
      await showEarnMenu(ctx);
      return true;
    case "truth":
      await handleTruth(ctx);
      return true;
    case "dare":
      await handleDare(ctx);
      return true;
  }

  return false;
}

export async function forwardAnonymousMessage(
  ctx: NarrowedContext<Context, Update.MessageUpdate>
) {
  const message = ctx.message;

  try {
    const telegramUserId = BigInt(ctx.from.id);

    const savePartnerUser = await prisma.user.findUnique({
      where: {
        telegramUserId,
      },
      select: {
        id: true,
        savePartnerState: true,
        pointsBalance: true,
      },
    });

    if (
      savePartnerUser?.savePartnerState === "WAITING_FOR_NICKNAME"
    ) {
      if (message && "text" in message && message.text) {
        const trimmed = message.text.trim();
        const lower = trimmed.toLowerCase();
        if (lower === "/cancel" || lower === "cancel") {
          await clearSavePartnerState(savePartnerUser.id);
          await ctx.reply("🗑️ Nickname saving cancelled.");
          return;
        }

        // If user typed another slash command (e.g. /stop or /search), clear state and let router process it
        if (trimmed.startsWith("/")) {
          await clearSavePartnerState(savePartnerUser.id);
          const routed = await routeCommandOrKeyword(ctx);
          if (routed) return;
        }
      }

      if (!("text" in message) || !message.text) {
        await ctx.reply(
          "❌ Invalid nickname\n\n" +
            "Nickname must be between 3 and 15 characters.\n\n" +
            "Letters and numbers only.\n\n" +
            "Please try again or send /cancel to abort."
        );

        return;
      }

      const validation =
        validatePartnerNickname(message.text);

      if (!validation.valid) {
        await ctx.reply(
          "❌ Invalid nickname\n\n" +
            "Nickname must be between 3 and 15 characters.\n\n" +
            "Letters and numbers only.\n\n" +
            "Please try again or send /cancel to abort."
        );

        return;
      }

      const previousPartner =
        await getPreviousPartner(savePartnerUser.id);

      if (!previousPartner) {
        await clearSavePartnerState(savePartnerUser.id);
        await ctx.reply(
          "ℹ️ You don't have a previous partner to save yet."
        );

        return;
      }

      if (previousPartner.nickname) {
        await clearSavePartnerState(savePartnerUser.id);
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

      const userId = savePartnerUser.id;

      const updateResult = await prisma.previousPartner.updateMany({
        where: {
          id: previousPartner.id,
          nickname: null,
        },
        data: {
          nickname: validation.nickname,
          updatedAt: new Date(),
        },
      });

      if (updateResult.count !== 1) {
        await clearSavePartnerState(userId);
        await ctx.reply(
          "💾 <b>Partner Already Saved</b>\n\n" +
            "This previous partner has already been saved.",
          {
            parse_mode: "HTML",
          }
        );

        return;
      }

      await clearSavePartnerState(userId);
      await ctx.reply(
        "✅ <b>Partner Saved!</b>\n\n" +
          `🏷️ Nickname: <b>${validation.nickname}</b>\n\n` +
          "You can reconnect with your saved partner anytime from the menu or /reopen.",
        {
          parse_mode: "HTML",
        }
      );

      return;
    }

    // ========================================
    // INTERCEPT COMMANDS & KEYWORDS
    // (Works in active chat, queue, or idle)
    // ========================================
    const wasRouted = await routeCommandOrKeyword(ctx);
    if (wasRouted) {
      return;
    }

    // ========================================
    // FIND CURRENT USER
    // ========================================

    const user = await prisma.user.findUnique({
      where: {
        telegramUserId,
      },
      select: {
        id: true,
        gender: true,
      },
    });

    if (!user) {
      await ctx.reply(
        "Please use /start first to create your TalkBuddy profile."
      );
      return;
    }

    if (!user.gender) {
      await ctx.reply(
        "Please select your gender first.",
        {
          reply_markup: getGenderKeyboard(),
        }
      );
      return;
    }

    // ========================================
    // FIND CURRENT CHAT
    // ========================================

    const queueEntry =
      await prisma.matchingQueue.findUnique({
        where: {
          userId: user.id,
        },
        select: {
          status: true,
          partnerUserId: true,
        },
      });

    if (
      !queueEntry ||
      queueEntry.status !== "MATCHED" ||
      !queueEntry.partnerUserId
    ) {
      if (queueEntry?.status === "WAITING") {
        await ctx.reply(
          "⏳ <b>Searching for a partner...</b>\n\n" +
            "Please wait while we find a match for you.\n\n" +
            "• Use /stop or /cancel to cancel search.",
          {
            parse_mode: "HTML",
            reply_markup: getWaitingPartnerKeyboard(),
          }
        );
        return;
      }

      await ctx.reply(
        "💬 You are not currently connected to anyone.\n\n" +
          "Use /search or 🔎 Find Someone to start a chat."
      );
      return;
    }

    // ========================================
    // FIND PARTNER
    // ========================================

    const partner = await prisma.user.findUnique({
      where: {
        id: queueEntry.partnerUserId,
      },
      select: {
        id: true,
        telegramUserId: true,
      },
    });

    if (!partner) {
      await prisma.matchingQueue.update({
        where: {
          userId: user.id,
        },
        data: {
          status: "ENDED",
          partnerUserId: null,
        },
      });

      await ctx.reply(
        "❌ Your chat has ended because your partner is no longer available.\n\n" +
          "Use 🔎 Find Someone to meet someone new."
      );

      return;
    }

    // ========================================
    // VERIFY PARTNER CONNECTION
    // ========================================

    const partnerQueue =
      await prisma.matchingQueue.findUnique({
        where: {
          userId: partner.id,
        },
        select: {
          status: true,
          partnerUserId: true,
        },
      });

    if (
      !partnerQueue ||
      partnerQueue.status !== "MATCHED" ||
      partnerQueue.partnerUserId !== user.id
    ) {
      await prisma.matchingQueue.update({
        where: {
          userId: user.id,
        },
        data: {
          status: "ENDED",
          partnerUserId: null,
        },
      });

      await ctx.reply(
        "❌ Your chat has ended.\n\n" +
          "Use 🔎 Find Someone to meet someone new."
      );

      return;
    }

    const partnerTelegramId =
      partner.telegramUserId.toString();

    // ========================================
    // FIND ACTIVE CHAT SESSION FOR LOGGING
    // ========================================

    const activeSession = await prisma.chatSession.findFirst({
      where: {
        status: "ACTIVE",
        OR: [
          { userOneId: user.id, userTwoId: partner.id },
          { userOneId: partner.id, userTwoId: user.id },
        ],
      },
      select: { id: true },
    });

    // ========================================
    // TEXT
    // ========================================

    if ("text" in message) {
      if (activeSession) {
        try {
          await prisma.chatMessage.create({
            data: {
              chatSessionId: activeSession.id,
              senderId: user.id,
              receiverId: partner.id,
              messageType: "TEXT",
              text: message.text,
            },
          });
        } catch (e) {
          console.error("Failed to log chat text message:", e);
        }
      }

      await ctx.telegram.sendMessage(
        partnerTelegramId,
        message.text
      );

      return;
    }

    // ========================================
    // PHOTO
    // ========================================

if ("photo" in ctx.message) {
  const photo =
    ctx.message.photo[
      ctx.message.photo.length - 1
    ];

  // ========================================
  // GET TELEGRAM FILE
  // ========================================

  const telegramFile = await ctx.telegram.getFile(
    photo.file_id
  );

  if (!telegramFile.file_path) {
    throw new Error(
      "Telegram did not provide a file path."
    );
  }

  // ========================================
  // DOWNLOAD ACTUAL IMAGE FROM TELEGRAM
  // ========================================

  const telegramFileUrl =
    `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${telegramFile.file_path}`;

  const response = await fetch(telegramFileUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to download Telegram file: ${response.status}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // ========================================
  // CREATE PERMANENT R2 PATH
  // ========================================

  const extension =
    telegramFile.file_path.split(".").pop() || "jpg";

  const storagePath =
    `users/${user.id}/photos/${crypto.randomUUID()}.${extension}`;

  // ========================================
  // UPLOAD TO CLOUDFLARE R2
  // ========================================

  await uploadToR2(
    storagePath,
    buffer,
    "image/jpeg"
  );

  // ========================================
  // SAVE DATABASE RECORD
  // ========================================

  await prisma.userMedia.create({
    data: {
      userId: user.id,
      type: "PHOTO",

      telegramFileId: photo.file_id,
      telegramFileUniqueId:
        photo.file_unique_id,

      width: photo.width,
      height: photo.height,

      caption:
        ctx.message.caption ?? null,

      telegramMessageId:
        ctx.message.message_id,

      storagePath,
      fileSize: BigInt(buffer.length),
      mimeType: "image/jpeg",
    },
  });

  // ========================================
  // ONLY NOW SEND TO PARTNER
  // ========================================

  await ctx.telegram.sendPhoto(
    partnerTelegramId,
    photo.file_id,
    {
      caption: ctx.message.caption,
    }
  );

  return;
}

    // ========================================
    // VIDEO
    // ========================================

if ("video" in ctx.message) {
  const video = ctx.message.video;

  // ========================================
  // GET TELEGRAM FILE
  // ========================================

  const telegramFile = await ctx.telegram.getFile(
    video.file_id
  );

  if (!telegramFile.file_path) {
    throw new Error(
      "Telegram did not provide a video file path."
    );
  }

  // ========================================
  // DOWNLOAD VIDEO
  // ========================================

  const telegramFileUrl =
    `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${telegramFile.file_path}`;

  const response = await fetch(telegramFileUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to download Telegram video: ${response.status}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // ========================================
  // R2 PATH
  // ========================================

  const extension =
    telegramFile.file_path.split(".").pop() || "mp4";

  const storagePath =
    `users/${user.id}/videos/${crypto.randomUUID()}.${extension}`;

  // ========================================
  // SAVE TO R2 FIRST
  // ========================================

  await uploadToR2(
    storagePath,
    buffer,
    "video/mp4"
  );

  // ========================================
  // SAVE DATABASE RECORD
  // ========================================

  await prisma.userMedia.create({
    data: {
      userId: user.id,
      type: "VIDEO",

      telegramFileId: video.file_id,
      telegramFileUniqueId:
        video.file_unique_id,

      width: video.width,
      height: video.height,
      duration: video.duration,

      caption:
        ctx.message.caption ?? null,

      telegramMessageId:
        ctx.message.message_id,

      storagePath,
      fileSize: BigInt(buffer.length),
      mimeType: "video/mp4",
    },
  });

  // ========================================
  // ONLY AFTER R2 + DB SUCCESS
  // SEND TO PARTNER
  // ========================================

  await ctx.telegram.sendVideo(
    partnerTelegramId,
    video.file_id,
    {
   caption: ctx.message.caption,
    }
  );

  return;
}

    // ========================================
    // GIF / ANIMATION
    // ========================================

if ("animation" in ctx.message) {
  const animation = ctx.message.animation;

  // ========================================
  // GET TELEGRAM FILE
  // ========================================

  const telegramFile = await ctx.telegram.getFile(
    animation.file_id
  );

  if (!telegramFile.file_path) {
    throw new Error(
      "Telegram did not provide an animation file path."
    );
  }

  // ========================================
  // DOWNLOAD GIF / ANIMATION
  // ========================================

  const telegramFileUrl =
    `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${telegramFile.file_path}`;

  const response = await fetch(telegramFileUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to download Telegram animation: ${response.status}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // ========================================
  // R2 PATH
  // ========================================

  const extension =
    telegramFile.file_path.split(".").pop() || "mp4";

  const storagePath =
    `users/${user.id}/animations/${crypto.randomUUID()}.${extension}`;

  // ========================================
  // SAVE TO R2 FIRST
  // ========================================

  await uploadToR2(
    storagePath,
    buffer,
    animation.mime_type || "video/mp4"
  );

  // ========================================
  // SAVE DATABASE RECORD
  // ========================================

  await prisma.userMedia.create({
    data: {
      userId: user.id,
      type: "ANIMATION",

      telegramFileId: animation.file_id,
      telegramFileUniqueId:
        animation.file_unique_id,

      width: animation.width,
      height: animation.height,
      duration: animation.duration,

      fileName:
        animation.file_name ?? null,

      mimeType:
        animation.mime_type ?? "video/mp4",

      caption:
        ctx.message.caption ?? null,

      telegramMessageId:
        ctx.message.message_id,

      storagePath,
      fileSize: BigInt(buffer.length),
    },
  });

  // ========================================
  // ONLY AFTER R2 + DB SUCCESS
  // SEND TO PARTNER
  // ========================================

  await ctx.telegram.sendAnimation(
    partnerTelegramId,
    animation.file_id,
    {
      caption: ctx.message.caption,
    }
  );

  return;
}

    // ========================================
    // STICKER
    // ========================================

if ("sticker" in message) {
  const sticker = message.sticker;

  // 1. Get Telegram file path
  const telegramFile = await ctx.telegram.getFile(
    sticker.file_id
  );

  if (!telegramFile.file_path) {
    throw new Error(
      "Telegram did not provide a sticker file path."
    );
  }

  // 2. Download the actual sticker binary
  const telegramFileUrl =
    `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${telegramFile.file_path}`;

  const response = await fetch(telegramFileUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to download Telegram sticker: ${response.status}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 3. Determine extension
  const extension =
    telegramFile.file_path.split(".").pop() || "webp";

  // 4. Permanent R2 path
  const storagePath =
    `users/${user.id}/stickers/${crypto.randomUUID()}.${extension}`;

  // 5. Upload to R2 FIRST
  await uploadToR2(
    storagePath,
    buffer,
    sticker.is_animated
      ? "application/x-tgsticker"
      : sticker.is_video
        ? "video/webm"
        : "image/webp"
  );

  // 6. Save metadata
  await prisma.userMedia.create({
    data: {
      userId: user.id,
      type: "STICKER",

      telegramFileId: sticker.file_id,
      telegramFileUniqueId: sticker.file_unique_id,

      mimeType: sticker.is_animated
        ? "application/x-tgsticker"
        : sticker.is_video
          ? "video/webm"
          : "image/webp",

      width: sticker.width,
      height: sticker.height,

      telegramMessageId: message.message_id,

      storagePath,

      fileSize: BigInt(buffer.length),
    },
  });

  // 7. ONLY AFTER R2 + DB SUCCESS → send to partner
  await ctx.telegram.sendSticker(
    partnerTelegramId,
    sticker.file_id
  );

  return;
}
    // ========================================
    // DOCUMENT / FILE
    // ========================================

if ("document" in message) {
  const document = message.document;

  // 1. Get Telegram file path
  const telegramFile = await ctx.telegram.getFile(
    document.file_id
  );

  if (!telegramFile.file_path) {
    throw new Error(
      "Telegram did not provide a document file path."
    );
  }

  // 2. Download the actual document binary
  const telegramFileUrl =
    `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${telegramFile.file_path}`;

  const response = await fetch(telegramFileUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to download Telegram document: ${response.status}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 3. Determine extension
  const extension =
    document.file_name?.split(".").pop() ||
    telegramFile.file_path.split(".").pop() ||
    "bin";

  // 4. Permanent R2 storage path
  const storagePath =
    `users/${user.id}/documents/${crypto.randomUUID()}.${extension}`;

  // 5. Upload to R2 FIRST
  await uploadToR2(
    storagePath,
    buffer,
    document.mime_type ?? "application/octet-stream"
  );

  // 6. Save metadata in PostgreSQL
  await prisma.userMedia.create({
    data: {
      userId: user.id,
      type: "DOCUMENT",

      telegramFileId: document.file_id,
      telegramFileUniqueId: document.file_unique_id,

      fileName: document.file_name ?? null,
      mimeType:
        document.mime_type ?? "application/octet-stream",

      telegramMessageId: message.message_id,

      storagePath,

      fileSize: BigInt(buffer.length),

      caption: message.caption ?? null,
    },
  });

  // 7. ONLY AFTER R2 + DB SUCCESS → send to partner
  await ctx.telegram.sendDocument(
    partnerTelegramId,
    document.file_id,
    {
      caption: message.caption,
    }
  );

  return;
}

    // ========================================
    // AUDIO
    // ========================================

// ========================================
// AUDIO
// ========================================

if ("audio" in message) {
  const audio = message.audio;

  // ========================================
  // GET TELEGRAM FILE
  // ========================================

  const telegramFile = await ctx.telegram.getFile(
    audio.file_id
  );

  if (!telegramFile.file_path) {
    throw new Error(
      "Telegram did not provide an audio file path."
    );
  }

  // ========================================
  // DOWNLOAD AUDIO FROM TELEGRAM
  // ========================================

  const telegramFileUrl =
    `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${telegramFile.file_path}`;

  const response = await fetch(telegramFileUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to download Telegram audio: ${response.status}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // ========================================
  // CREATE R2 PATH
  // ========================================

  const extension =
    telegramFile.file_path.split(".").pop() || "mp3";

  const storagePath =
    `users/${user.id}/audios/${crypto.randomUUID()}.${extension}`;

  // ========================================
  // SAVE TO R2 FIRST
  // ========================================

  await uploadToR2(
    storagePath,
    buffer,
    audio.mime_type ?? "audio/mpeg"
  );

  // ========================================
  // SAVE DATABASE RECORD
  // ========================================

  await prisma.userMedia.create({
    data: {
      userId: user.id,
      type: "AUDIO",

      telegramFileId: audio.file_id,
      telegramFileUniqueId:
        audio.file_unique_id,

      fileName:
        audio.file_name ?? null,

      mimeType:
        audio.mime_type ?? "audio/mpeg",

      duration:
        audio.duration,

      caption:
        message.caption ?? null,

      telegramMessageId:
        message.message_id,

      storagePath,

      fileSize:
        BigInt(buffer.length),
    },
  });

  // ========================================
  // ONLY AFTER R2 + DB SUCCESS
  // SEND TO PARTNER
  // ========================================

  await ctx.telegram.sendAudio(
    partnerTelegramId,
    audio.file_id,
    {
      caption: message.caption,
    }
  );

  return;
}
    // ========================================
    // VOICE
    // ========================================

// ========================================
// VOICE MESSAGE
// ========================================

if ("voice" in message) {
  const voice = message.voice;

  // ========================================
  // GET TELEGRAM FILE
  // ========================================

  const telegramFile = await ctx.telegram.getFile(
    voice.file_id
  );

  if (!telegramFile.file_path) {
    throw new Error(
      "Telegram did not provide a voice file path."
    );
  }

  // ========================================
  // DOWNLOAD VOICE FROM TELEGRAM
  // ========================================

  const telegramFileUrl =
    `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${telegramFile.file_path}`;

  const response = await fetch(telegramFileUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to download Telegram voice: ${response.status}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // ========================================
  // CREATE R2 PATH
  // ========================================

  const extension =
    telegramFile.file_path.split(".").pop() || "ogg";

  const storagePath =
    `users/${user.id}/voices/${crypto.randomUUID()}.${extension}`;

  // ========================================
  // SAVE TO R2 FIRST
  // ========================================

  await uploadToR2(
    storagePath,
    buffer,
    voice.mime_type ?? "audio/ogg"
  );

  // ========================================
  // SAVE DATABASE RECORD
  // ========================================

  await prisma.userMedia.create({
    data: {
      userId: user.id,
      type: "VOICE",

      telegramFileId: voice.file_id,
      telegramFileUniqueId:
        voice.file_unique_id,

      mimeType:
        voice.mime_type ?? "audio/ogg",

      duration:
        voice.duration,

      telegramMessageId:
        message.message_id,

      storagePath,

      fileSize:
        BigInt(buffer.length),
    },
  });

  // ========================================
  // ONLY AFTER R2 + DB SUCCESS
  // SEND TO PARTNER
  // ========================================

  await ctx.telegram.sendVoice(
    partnerTelegramId,
    voice.file_id
  );

  return;
}

    // ========================================
    // VIDEO NOTE
    // ========================================

if ("video_note" in message) {
  const videoNote = message.video_note;

  // 1. Get the Telegram file path
  const telegramFile = await ctx.telegram.getFile(
    videoNote.file_id
  );

  if (!telegramFile.file_path) {
    throw new Error(
      "Telegram did not provide a video note file path."
    );
  }

  // 2. Download the actual video binary from Telegram
  const telegramFileUrl =
    `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${telegramFile.file_path}`;

  const response = await fetch(telegramFileUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to download Telegram video note: ${response.status}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 3. Determine extension
  const extension =
    telegramFile.file_path.split(".").pop() || "mp4";

  // 4. Create permanent R2 storage path
  const storagePath =
    `users/${user.id}/video-notes/${crypto.randomUUID()}.${extension}`;

  // 5. Upload to Cloudflare R2 FIRST
  await uploadToR2(
    storagePath,
    buffer,
    "video/mp4"
  );

  // 6. Save media metadata in PostgreSQL
  await prisma.userMedia.create({
    data: {
      userId: user.id,
      type: "VIDEO_NOTE",

      telegramFileId: videoNote.file_id,
      telegramFileUniqueId: videoNote.file_unique_id,

      mimeType: "video/mp4",

      width: videoNote.length,
      height: videoNote.length,
      duration: videoNote.duration,

      telegramMessageId: message.message_id,

      storagePath,

      fileSize: BigInt(buffer.length),
    },
  });

  // 7. ONLY AFTER R2 + DB SUCCESS → send to partner
  await ctx.telegram.sendVideoNote(
    partnerTelegramId,
    videoNote.file_id
  );

  return;
}

    // ========================================
    // CONTACT
    // ========================================

if ("contact" in message) {
  const contact = message.contact;

  await ctx.telegram.sendContact(
    partnerTelegramId,
    contact.phone_number,
    contact.first_name,
    {
      last_name: contact.last_name,
      vcard: contact.vcard,
    }
  );

  return;
}

    // ========================================
    // LOCATION
    // ========================================

if ("location" in message) {
  const location = message.location;

  await ctx.telegram.sendLocation(
    partnerTelegramId,
    location.latitude,
    location.longitude
  );

  return;
}

    // ========================================
    // VENUE
    // ========================================

    // if ("venue" in message) {
    //   const venue = message.venue;

    //   await ctx.telegram.sendVenue(
    //     partnerTelegramId,
    //     venue.location.latitude,
    //     venue.location.longitude,
    //     venue.title,
    //     venue.address
    //   );

    //   return;
    // }

    if ("location" in ctx.message) {
  const location = ctx.message.location;

  await ctx.telegram.sendLocation(
    partnerTelegramId,
    location.latitude,
    location.longitude
  );

  return;
}
    // ========================================
    // DICE
    // ========================================

if ("dice" in message) {
  const dice = message.dice;

  await ctx.telegram.sendDice(
    partnerTelegramId,
    {
      emoji: dice.emoji,
    }
  );

  return;
}
    // ========================================
    // POLL
    // ========================================

if ("poll" in message) {
  const poll = message.poll;

  await ctx.telegram.sendPoll(
    partnerTelegramId,
    poll.question,
    poll.options.map((option) => option.text),
    {
      is_anonymous: true,
      allows_multiple_answers: poll.allows_multiple_answers,
      correct_option_id:
        poll.type === "quiz"
          ? poll.correct_option_id
          : undefined,
      explanation:
        poll.type === "quiz"
          ? poll.explanation
          : undefined,
    }
  );

  return;
}

    // ========================================
    // UNSUPPORTED MESSAGE
    // ========================================

    await ctx.reply(
      "⚠️ This type of message is not supported yet."
    );
  } catch (error) {
    console.error(
      "Anonymous message forwarding error:",
      error
    );

    await ctx.reply(
      "⚠️ I couldn't deliver that message. Please try again."
    );
  }
}

export function registerMessageHandler(bot: Telegraf) {
  bot.on("message", async (ctx) => {
    await forwardAnonymousMessage(ctx);
  });
}