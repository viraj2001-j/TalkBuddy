import type { Telegraf, Context } from "telegraf";
import prisma from "@/lib/db";
import { getUserVipStatus } from "@/lib/telegram/vip";
import { saveUserSetting } from "@/lib/telegram/user-settings";

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Step 1/4: Name Confirmation / Edit
 */
export async function renderVipStepName(ctx: Context, user: any) {
  const currentName = escapeHtml(user.firstName || ctx.from?.first_name || "User");
  const text =
    `🎯 <b>VIP Profile Setup (Step 1 of 4): Name</b>\n\n` +
    `👤 <b>Your Display Name:</b> <b>${currentName}</b>\n\n` +
    `Confirm your name to continue, or tap below to proceed:`;

  const reply_markup = {
    inline_keyboard: [
      [
        {
          text: `✅ Keep "${currentName}" & Next ➡️`,
          callback_data: "vip_step_age",
        },
      ],
      [
        {
          text: "⏭️ Skip to Gender Filter",
          callback_data: "vip_filter_select",
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

  await safeEditOrReply(ctx, text, reply_markup);
}

/**
 * Step 2/4: Age Selection (Optional)
 */
export async function renderVipStepAge(ctx: Context, user: any) {
  const currentAge = user.age ? `${user.age} Years` : "Not set";
  const text =
    `🎯 <b>VIP Profile Setup (Step 2 of 4): Age</b> <i>(Optional)</i>\n\n` +
    `🎂 <b>Current Age:</b> <b>${currentAge}</b>\n\n` +
    `Select your age group below, or tap <b>Skip</b> to proceed without setting an age:`;

  const reply_markup = {
    inline_keyboard: [
      [
        { text: "18-21", callback_data: "vip_save_age_20" },
        { text: "22-25", callback_data: "vip_save_age_24" },
        { text: "26-30", callback_data: "vip_save_age_28" },
      ],
      [
        { text: "31-35", callback_data: "vip_save_age_33" },
        { text: "36-40", callback_data: "vip_save_age_38" },
        { text: "40+", callback_data: "vip_save_age_45" },
      ],
      [
        {
          text: "⏭️ Skip Age & Next ➡️",
          callback_data: "vip_step_gender",
        },
      ],
      [
        {
          text: "⬅️ Back",
          callback_data: "vip_step_name",
        },
      ],
    ],
  };

  await safeEditOrReply(ctx, text, reply_markup);
}

/**
 * Step 3/4: Gender Selection (Required for accurate filtering)
 */
export async function renderVipStepGender(ctx: Context, user: any) {
  const currentGender = user.gender ? escapeHtml(user.gender) : "Not set";
  const text =
    `🎯 <b>VIP Profile Setup (Step 3 of 4): Gender</b>\n\n` +
    `👤 <b>Your Gender:</b> <b>${currentGender}</b>\n\n` +
    `Please select your gender so our partner filter matches you accurately:`;

  const reply_markup = {
    inline_keyboard: [
      [
        { text: "👨 Male", callback_data: "vip_save_gender_Male" },
        { text: "👩 Female", callback_data: "vip_save_gender_Female" },
      ],
      [
        { text: "🏳️‍⚧️ Trans Man", callback_data: "vip_save_gender_Trans Man" },
        { text: "🏳️‍⚧️ Trans Woman", callback_data: "vip_save_gender_Trans Woman" },
      ],
      [
        { text: "🧑 Non-binary", callback_data: "vip_save_gender_Non-binary" },
      ],
      [
        { text: "⬅️ Back to Age", callback_data: "vip_step_age" },
      ],
    ],
  };

  await safeEditOrReply(ctx, text, reply_markup);
}

/**
 * Step 4/4: Location Selection (Optional)
 */
export async function renderVipStepLocation(ctx: Context, user: any) {
  const currentCountry = user.country ? escapeHtml(user.country) : "Not set";
  const text =
    `🎯 <b>VIP Profile Setup (Step 4 of 4): Location</b> <i>(Optional)</i>\n\n` +
    `🌍 <b>Current Country:</b> <b>${currentCountry}</b>\n\n` +
    `Select your country or region below, or tap <b>Skip</b> to proceed:`;

  const reply_markup = {
    inline_keyboard: [
      [
        { text: "🇱🇰 Sri Lanka", callback_data: "vip_save_country_Sri Lanka" },
        { text: "🇮🇳 India", callback_data: "vip_save_country_India" },
      ],
      [
        { text: "🇺🇸 United States", callback_data: "vip_save_country_United States" },
        { text: "🇬🇧 United Kingdom", callback_data: "vip_save_country_United Kingdom" },
      ],
      [
        { text: "🇦🇪 UAE / Gulf", callback_data: "vip_save_country_UAE" },
        { text: "🇨🇦 Canada", callback_data: "vip_save_country_Canada" },
      ],
      [
        { text: "🌍 Worldwide / Other", callback_data: "vip_save_country_Worldwide" },
      ],
      [
        {
          text: "⏭️ Skip Location & Choose Filter ➡️",
          callback_data: "vip_filter_select",
        },
      ],
      [
        { text: "⬅️ Back to Gender", callback_data: "vip_step_gender" },
      ],
    ],
  };

  await safeEditOrReply(ctx, text, reply_markup);
}

/**
 * Final Step: Dedicated VIP Gender Filter Menu
 */
export async function renderVipGenderFilterMenu(ctx: Context, user: any) {
  const rawId = ctx.from?.id;
  if (!rawId) return;

  const vipInfo = await getUserVipStatus(user.id);
  const isVip = vipInfo.isVip;

  if (!isVip) {
    const text =
      `🔒 <b>VIP Gender Filter Locked</b>\n\n` +
      `The <b>Gender Filter</b> is an exclusive feature for TalkBuddy VIP members.\n\n` +
      `Upgrade your membership to choose whether you chat with Women, Men, or Anyone!`;

    const reply_markup = {
      inline_keyboard: [
        [{ text: "👑 View VIP Plans", callback_data: "vip_info" }],
        [{ text: "⬅️ Main Menu", callback_data: "back_main_menu" }],
      ],
    };
    await safeEditOrReply(ctx, text, reply_markup);
    return;
  }

  const activeFilter = user.genderFilterPreference || "ANY";
  let filterDisplay = "🔄 Any Gender (Fastest)";
  if (activeFilter === "Female") filterDisplay = "👩 Female Only (Women)";
  else if (activeFilter === "Male") filterDisplay = "👨 Male Only (Men)";
  else if (activeFilter.includes("Trans")) filterDisplay = "🏳️‍⚧️ Trans Only";

  const userName = escapeHtml(user.firstName || ctx.from?.first_name || "User");
  const userGender = escapeHtml(user.gender || "Not set");
  const userAge = user.age ? `${user.age} Years` : "Not set (Optional)";
  const userLocation = user.country ? escapeHtml(user.country) : "Not set (Optional)";

  const text =
    `👑 <b>VIP Partner Gender Filter</b> 🎯\n\n` +
    `👤 <b>Your Profile:</b>\n` +
    `• Name: <b>${userName}</b>\n` +
    `• Your Gender: <b>${userGender}</b>\n` +
    `• Age: <b>${userAge}</b>\n` +
    `• Location: <b>${userLocation}</b>\n\n` +
    `🎯 <b>Active Matching Filter:</b>\n` +
    `👉 <b>${filterDisplay}</b>\n\n` +
    `👇 <b>Choose who you want to match with:</b>\n` +
    `Our matchmaking queue will prioritize partners matching your exact selection:`;

  const isFemaleSelected = activeFilter === "Female";
  const isMaleSelected = activeFilter === "Male";
  const isTransSelected = activeFilter.includes("Trans");
  const isAnySelected = activeFilter === "ANY";

  const reply_markup = {
    inline_keyboard: [
      [
        {
          text: `${isFemaleSelected ? "✅ " : ""}👩 Match with Women (Female)`,
          callback_data: "vip_set_filter_Female",
        },
      ],
      [
        {
          text: `${isMaleSelected ? "✅ " : ""}👨 Match with Men (Male)`,
          callback_data: "vip_set_filter_Male",
        },
      ],
      [
        {
          text: `${isTransSelected ? "✅ " : ""}🏳️‍⚧️ Match with Trans`,
          callback_data: "vip_set_filter_Trans Man",
        },
      ],
      [
        {
          text: `${isAnySelected ? "✅ " : ""}🔄 Match with Anyone (Fastest)`,
          callback_data: "vip_set_filter_ANY",
        },
      ],
      [
        {
          text: "🔎 Start Matching Now",
          callback_data: "menu_find",
        },
      ],
      [
        {
          text: "✏️ Edit Profile Info",
          callback_data: "vip_step_name",
        },
        {
          text: "⚙️ Settings",
          callback_data: "menu_settings",
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

  await safeEditOrReply(ctx, text, reply_markup);
}

/**
 * Helper to safely edit previous message or send fresh reply if editing isn't possible
 */
async function safeEditOrReply(ctx: Context, text: string, reply_markup: any) {
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup,
      });
      return;
    } catch (err: any) {
      const msg = err?.description || err?.message || "";
      if (msg.includes("message is not modified")) return;
    }
  }

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup,
  });
}

/**
 * Handle /filter command directly
 */
export async function handleGenderFilterCommand(ctx: Context) {
  try {
    const rawId = ctx.from?.id;
    if (!rawId) return;
    const user = await prisma.user.findUnique({
      where: { telegramUserId: BigInt(rawId) },
    });
    if (!user) {
      await ctx.reply("👋 Please use /start first to setup your profile.");
      return;
    }
    await renderVipGenderFilterMenu(ctx, user);
  } catch (err) {
    console.error("handleGenderFilterCommand error:", err);
    await ctx.reply("❌ Error loading gender filter. Please try again.");
  }
}

/**
 * Register all VIP Onboarding and Gender Filter actions on the Telegraf bot instance
 */
export function registerVipOnboardingHandlers(bot: Telegraf) {
  // Command: /filter
  bot.command("filter", handleGenderFilterCommand);
  bot.command("genderfilter", handleGenderFilterCommand);

  // Entry: Start VIP profile setup & filter flow
  bot.action("vip_onboard_start", async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
      const rawId = ctx.from?.id;
      if (!rawId) return;
      const user = await prisma.user.findUnique({
        where: { telegramUserId: BigInt(rawId) },
      });
      if (!user) return;

      // Start at Step 1: Name
      await renderVipStepName(ctx, user);
    } catch (err) {
      console.error("vip_onboard_start error:", err);
    }
  });

  // Step 1: Name
  bot.action("vip_step_name", async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
      const rawId = ctx.from?.id;
      if (!rawId) return;
      const user = await prisma.user.findUnique({
        where: { telegramUserId: BigInt(rawId) },
      });
      if (user) await renderVipStepName(ctx, user);
    } catch (err) {}
  });

  // Step 2: Age
  bot.action("vip_step_age", async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
      const rawId = ctx.from?.id;
      if (!rawId) return;
      const user = await prisma.user.findUnique({
        where: { telegramUserId: BigInt(rawId) },
      });
      if (user) await renderVipStepAge(ctx, user);
    } catch (err) {}
  });

  // Step 2 Save Age
  bot.action(/^vip_save_age_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
      const rawId = ctx.from?.id;
      if (!rawId) return;
      const age = parseInt(ctx.match[1], 10);
      await saveUserSetting(BigInt(rawId), { age });

      const updatedUser = await prisma.user.findUnique({
        where: { telegramUserId: BigInt(rawId) },
      });
      // Move to Step 3: Gender
      if (updatedUser) await renderVipStepGender(ctx, updatedUser);
    } catch (err) {
      console.error("vip_save_age error:", err);
    }
  });

  // Step 3: Gender
  bot.action("vip_step_gender", async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
      const rawId = ctx.from?.id;
      if (!rawId) return;
      const user = await prisma.user.findUnique({
        where: { telegramUserId: BigInt(rawId) },
      });
      if (user) await renderVipStepGender(ctx, user);
    } catch (err) {}
  });

  // Step 3 Save Gender
  bot.action(/^vip_save_gender_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
      const rawId = ctx.from?.id;
      if (!rawId) return;
      const gender = ctx.match[1];
      await saveUserSetting(BigInt(rawId), { gender });

      const updatedUser = await prisma.user.findUnique({
        where: { telegramUserId: BigInt(rawId) },
      });
      // Move to Step 4: Location
      if (updatedUser) await renderVipStepLocation(ctx, updatedUser);
    } catch (err) {
      console.error("vip_save_gender error:", err);
    }
  });

  // Step 4: Location
  bot.action("vip_step_location", async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
      const rawId = ctx.from?.id;
      if (!rawId) return;
      const user = await prisma.user.findUnique({
        where: { telegramUserId: BigInt(rawId) },
      });
      if (user) await renderVipStepLocation(ctx, user);
    } catch (err) {}
  });

  // Step 4 Save Country
  bot.action(/^vip_save_country_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
      const rawId = ctx.from?.id;
      if (!rawId) return;
      const country = ctx.match[1];
      await saveUserSetting(BigInt(rawId), { country });

      const updatedUser = await prisma.user.findUnique({
        where: { telegramUserId: BigInt(rawId) },
      });
      // Complete! Move to Final Step: Gender Filter
      if (updatedUser) await renderVipGenderFilterMenu(ctx, updatedUser);
    } catch (err) {
      console.error("vip_save_country error:", err);
    }
  });

  // Step 5: Direct Gender Filter Menu entry
  bot.action("vip_filter_select", async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
      const rawId = ctx.from?.id;
      if (!rawId) return;
      const user = await prisma.user.findUnique({
        where: { telegramUserId: BigInt(rawId) },
      });
      if (user) await renderVipGenderFilterMenu(ctx, user);
    } catch (err) {
      console.error("vip_filter_select error:", err);
    }
  });

  // Step 5: Set Gender Filter Preference
  bot.action(/^vip_set_filter_(Male|Female|Trans Man|Trans Woman|ANY)$/, async (ctx) => {
    try {
      const rawId = ctx.from?.id;
      if (!rawId) {
        await ctx.answerCbQuery().catch(() => {});
        return;
      }
      const preference = ctx.match[1];
      const telegramUserId = BigInt(rawId);

      const user = await prisma.user.findUnique({
        where: { telegramUserId },
      });
      if (!user) {
        await ctx.answerCbQuery().catch(() => {});
        return;
      }

      const vipInfo = await getUserVipStatus(user.id);
      if (!vipInfo.isVip) {
        await ctx.answerCbQuery("🔒 Gender Filter requires VIP. Upgrade via /vip!", { show_alert: true });
        return;
      }

      await saveUserSetting(telegramUserId, {
        genderFilterPreference: preference,
      });

      const label =
        preference === "Female"
          ? "Women (Female)"
          : preference === "Male"
          ? "Men (Male)"
          : preference === "ANY"
          ? "Anyone"
          : preference;

      await ctx.answerCbQuery(`✅ Gender Filter set to: ${label}!`, { show_alert: true });

      const updatedUser = await prisma.user.findUnique({
        where: { telegramUserId },
      });
      if (updatedUser) {
        await renderVipGenderFilterMenu(ctx, updatedUser);
      }
    } catch (err) {
      console.error("vip_set_filter error:", err);
      try {
        await ctx.answerCbQuery().catch(() => {});
      } catch {}
    }
  });
}
