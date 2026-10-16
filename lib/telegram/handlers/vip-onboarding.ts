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

// ==========================================
// CODE MAPPINGS (Stateless Compact Encoding)
// ==========================================

function decodeAge(code: string): number | null {
  const n = parseInt(code, 10);
  return n > 0 ? n : null;
}

function ageLabel(code: string): string {
  switch (code) {
    case "20": return "18-21 Years";
    case "24": return "22-25 Years";
    case "28": return "26-30 Years";
    case "33": return "31-35 Years";
    case "38": return "36-40 Years";
    case "45": return "40+ Years";
    default: return "Not set (Skipped)";
  }
}

function decodeGender(code: string): string {
  switch (code) {
    case "M": return "Male";
    case "F": return "Female";
    case "TM": return "Trans Man";
    case "TW": return "Trans Woman";
    case "NB": return "Non-binary";
    default: return "Male";
  }
}

function genderLabel(code: string): string {
  switch (code) {
    case "M": return "👨 Male";
    case "F": return "👩 Female";
    case "TM": return "🏳️‍⚧️ Trans Man";
    case "TW": return "🏳️‍⚧️ Trans Woman";
    case "NB": return "🧑 Non-binary";
    default: return "Not set";
  }
}

function decodeCountry(code: string): string | null {
  switch (code) {
    case "LK": return "Sri Lanka";
    case "IN": return "India";
    case "US": return "United States";
    case "GB": return "United Kingdom";
    case "AE": return "UAE";
    case "CA": return "Canada";
    case "WW": return "Worldwide";
    default: return null;
  }
}

function countryLabel(code: string): string {
  switch (code) {
    case "LK": return "🇱🇰 Sri Lanka";
    case "IN": return "🇮🇳 India";
    case "US": return "🇺🇸 United States";
    case "GB": return "🇬🇧 United Kingdom";
    case "AE": return "🇦🇪 UAE / Gulf";
    case "CA": return "🇨🇦 Canada";
    case "WW": return "🌍 Worldwide";
    default: return "Not set (Skipped)";
  }
}

function decodeFilter(code: string): string {
  switch (code) {
    case "F": return "Female";
    case "M": return "Male";
    case "TM": return "Trans Man";
    case "ANY": return "ANY";
    default: return "ANY";
  }
}

function filterLabel(code: string): string {
  switch (code) {
    case "F": return "👩 Women (Female)";
    case "M": return "👨 Men (Male)";
    case "TM": return "🏳️‍⚧️ Trans";
    case "ANY": return "🔄 Anyone (Fastest)";
    default: return "🔄 Anyone";
  }
}

// ==========================================
// STEP 1: AGE (No database write)
// ==========================================
export async function renderVipStepAge(ctx: Context) {
  const text =
    `🎯 <b>VIP Profile Setup (Step 1 of 4): Age</b> <i>(Optional)</i>\n\n` +
    `Select your age group below, or tap <b>Skip</b>:\n\n` +
    `<i>⚠️ Nothing will be saved to your profile until you tap Complete at the end.</i>`;

  const reply_markup = {
    inline_keyboard: [
      [
        { text: "18-21", callback_data: "vip_ob_age_20" },
        { text: "22-25", callback_data: "vip_ob_age_24" },
        { text: "26-30", callback_data: "vip_ob_age_28" },
      ],
      [
        { text: "31-35", callback_data: "vip_ob_age_33" },
        { text: "36-40", callback_data: "vip_ob_age_38" },
        { text: "40+", callback_data: "vip_ob_age_45" },
      ],
      [
        {
          text: "⏭️ Skip Age & Next ➡️",
          callback_data: "vip_ob_age_0",
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

// ==========================================
// STEP 2: GENDER (No database write)
// ==========================================
export async function renderVipStepGender(ctx: Context, ageCode: string) {
  const text =
    `🎯 <b>VIP Profile Setup (Step 2 of 4): Your Gender</b>\n\n` +
    `• Selected Age: <b>${ageLabel(ageCode)}</b>\n\n` +
    `Please select your gender for accurate matching:\n\n` +
    `<i>⚠️ Nothing will be saved to your profile until you tap Complete at the end.</i>`;

  const reply_markup = {
    inline_keyboard: [
      [
        { text: "👨 Male", callback_data: `vip_ob_gen_${ageCode}_M` },
        { text: "👩 Female", callback_data: `vip_ob_gen_${ageCode}_F` },
      ],
      [
        { text: "🏳️‍⚧️ Trans Man", callback_data: `vip_ob_gen_${ageCode}_TM` },
        { text: "🏳️‍⚧️ Trans Woman", callback_data: `vip_ob_gen_${ageCode}_TW` },
      ],
      [
        { text: "🧑 Non-binary", callback_data: `vip_ob_gen_${ageCode}_NB` },
      ],
      [
        { text: "⬅️ Back to Age", callback_data: "vip_onboard_start" },
      ],
    ],
  };

  await safeEditOrReply(ctx, text, reply_markup);
}

// ==========================================
// STEP 3: LOCATION (No database write)
// ==========================================
export async function renderVipStepLocation(
  ctx: Context,
  ageCode: string,
  genderCode: string
) {
  const text =
    `🎯 <b>VIP Profile Setup (Step 3 of 4): Your Country</b> <i>(Optional)</i>\n\n` +
    `• Age: <b>${ageLabel(ageCode)}</b>\n` +
    `• Gender: <b>${genderLabel(genderCode)}</b>\n\n` +
    `Select your location, or tap <b>Skip</b>:\n\n` +
    `<i>⚠️ Nothing will be saved to your profile until you tap Complete at the end.</i>`;

  const prefix = `vip_ob_loc_${ageCode}_${genderCode}`;

  const reply_markup = {
    inline_keyboard: [
      [
        { text: "🇱🇰 Sri Lanka", callback_data: `${prefix}_LK` },
        { text: "🇮🇳 India", callback_data: `${prefix}_IN` },
      ],
      [
        { text: "🇺🇸 United States", callback_data: `${prefix}_US` },
        { text: "🇬🇧 United Kingdom", callback_data: `${prefix}_GB` },
      ],
      [
        { text: "🇦🇪 UAE / Gulf", callback_data: `${prefix}_AE` },
        { text: "🇨🇦 Canada", callback_data: `${prefix}_CA` },
      ],
      [
        { text: "🌍 Worldwide / Other", callback_data: `${prefix}_WW` },
      ],
      [
        {
          text: "⏭️ Skip Country & Next ➡️",
          callback_data: `${prefix}_0`,
        },
      ],
      [
        {
          text: "⬅️ Back to Gender",
          callback_data: `vip_ob_age_${ageCode}`,
        },
      ],
    ],
  };

  await safeEditOrReply(ctx, text, reply_markup);
}

// ==========================================
// STEP 4: TARGET GENDER FILTER (No database write)
// ==========================================
export async function renderVipStepFilter(
  ctx: Context,
  ageCode: string,
  genderCode: string,
  locCode: string
) {
  const text =
    `🎯 <b>VIP Profile Setup (Step 4 of 4): Matching Gender Filter</b>\n\n` +
    `• Age: <b>${ageLabel(ageCode)}</b>\n` +
    `• Gender: <b>${genderLabel(genderCode)}</b>\n` +
    `• Country: <b>${countryLabel(locCode)}</b>\n\n` +
    `👑 <b>Choose who you want to match with:</b>\n` +
    `TalkBuddy will match you according to an <b>80% priority ratio</b> (8 out of 10 matches will be your chosen gender):\n\n` +
    `<i>⚠️ Nothing will be saved to your profile until you tap Complete on the next step.</i>`;

  const prefix = `vip_ob_rev_${ageCode}_${genderCode}_${locCode}`;

  const reply_markup = {
    inline_keyboard: [
      [
        {
          text: "👩 Match with Women (Female) — 80%",
          callback_data: `${prefix}_F`,
        },
      ],
      [
        {
          text: "👨 Match with Men (Male) — 80%",
          callback_data: `${prefix}_M`,
        },
      ],
      [
        {
          text: "🏳️‍⚧️ Match with Trans — 80%",
          callback_data: `${prefix}_TM`,
        },
      ],
      [
        {
          text: "🔄 Match with Anyone (Fastest)",
          callback_data: `${prefix}_ANY`,
        },
      ],
      [
        {
          text: "⬅️ Back to Country",
          callback_data: `vip_ob_gen_${ageCode}_${genderCode}`,
        },
      ],
    ],
  };

  await safeEditOrReply(ctx, text, reply_markup);
}

// ==========================================
// STEP 5: REVIEW SCREEN WITH COMPLETE BUTTON (No database write yet)
// ==========================================
export async function renderVipReviewScreen(
  ctx: Context,
  ageCode: string,
  genderCode: string,
  locCode: string,
  filterCode: string
) {
  const donePayload = `vip_ob_done_${ageCode}_${genderCode}_${locCode}_${filterCode}`;

  const text =
    `🎯 <b>VIP Profile & Filter Setup Summary</b>\n\n` +
    `Please review all your details before completing setup:\n\n` +
    `• <b>Your Age:</b> <b>${ageLabel(ageCode)}</b>\n` +
    `• <b>Your Gender:</b> <b>${genderLabel(genderCode)}</b>\n` +
    `• <b>Your Location:</b> <b>${countryLabel(locCode)}</b>\n` +
    `• <b>Target Match Filter:</b> <b>${filterLabel(filterCode)}</b>\n` +
    `• <b>Match Priority:</b> ⭐ <b>80% ${filterLabel(filterCode)} / 20% Other</b>\n\n` +
    `⚠️ <b>Notice:</b> Until you tap the <b>Complete</b> button below, none of these details are saved to your profile.\n\n` +
    `👇 <b>Tap below to complete and save everything:</b>`;

  const reply_markup = {
    inline_keyboard: [
      [
        {
          text: "✅ Complete & Save Profile",
          callback_data: donePayload,
        },
      ],
      [
        {
          text: "🔄 Start Over",
          callback_data: "vip_onboard_start",
        },
      ],
      [
        {
          text: "❌ Cancel",
          callback_data: "back_main_menu",
        },
      ],
    ],
  };

  await safeEditOrReply(ctx, text, reply_markup);
}

// ==========================================
// DEDICATED VIP GENDER FILTER MENU (/filter)
// ==========================================
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
        [{ text: "👑 VIP Plans (⭐ Stars)", callback_data: "vip_info" }],
        [{ text: "⬅️ Main Menu", callback_data: "back_main_menu" }],
      ],
    };
    await safeEditOrReply(ctx, text, reply_markup);
    return;
  }

  const activeFilter = user.genderFilterPreference || "ANY";
  let filterDisplay = "🔄 Any Gender (Fastest)";
  if (activeFilter === "Female") filterDisplay = "👩 Female (80% Women / 20% Other)";
  else if (activeFilter === "Male") filterDisplay = "👨 Male (80% Men / 20% Other)";
  else if (activeFilter.includes("Trans")) filterDisplay = "🏳️‍⚧️ Trans (80% Trans / 20% Other)";

  const userName = escapeHtml(user.firstName || ctx.from?.first_name || "User");
  const userGender = escapeHtml(user.gender || "Not set");
  const userAge = user.age ? `${user.age} Years` : "Not set (Optional)";
  const userLocation = user.country ? escapeHtml(user.country) : "Not set (Optional)";

  const text =
    `👑 <b>VIP Partner Gender Filter</b> 🎯\n\n` +
    `👤 <b>Your Current Profile:</b>\n` +
    `• Name: <b>${userName}</b>\n` +
    `• Your Gender: <b>${userGender}</b>\n` +
    `• Age: <b>${userAge}</b>\n` +
    `• Location: <b>${userLocation}</b>\n\n` +
    `🎯 <b>Active Matching Filter:</b>\n` +
    `👉 <b>${filterDisplay}</b>\n\n` +
    `Select a filter below, or tap <b>Setup Full Profile</b>:`;

  const isFemaleSelected = activeFilter === "Female";
  const isMaleSelected = activeFilter === "Male";
  const isTransSelected = activeFilter.includes("Trans");
  const isAnySelected = activeFilter === "ANY";

  const reply_markup = {
    inline_keyboard: [
      [
        {
          text: `${isFemaleSelected ? "✅ " : ""}👩 Women (80% Female / 20% Male)`,
          callback_data: "vip_ask_filter_Female",
        },
      ],
      [
        {
          text: `${isMaleSelected ? "✅ " : ""}👨 Men (80% Male / 20% Female)`,
          callback_data: "vip_ask_filter_Male",
        },
      ],
      [
        {
          text: `${isTransSelected ? "✅ " : ""}🏳️‍⚧️ Trans (80% Trans / 20% Other)`,
          callback_data: "vip_ask_filter_Trans Man",
        },
      ],
      [
        {
          text: `${isAnySelected ? "✅ " : ""}🔄 Anyone (Fastest)`,
          callback_data: "vip_ask_filter_ANY",
        },
      ],
      [
        {
          text: "🎯 Setup Full VIP Profile (Age, Gender, Filter)",
          callback_data: "vip_onboard_start",
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
          text: "⬅️ Main Menu",
          callback_data: "back_main_menu",
        },
      ],
    ],
  };

  await safeEditOrReply(ctx, text, reply_markup);
}

// ==========================================
// HELPER: SAFE EDIT OR REPLY
// ==========================================
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

// ==========================================
// COMMAND: /filter
// ==========================================
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

// ==========================================
// REGISTER ALL VIP ONBOARDING & FILTER HANDLERS
// ==========================================
export function registerVipOnboardingHandlers(bot: Telegraf) {
  bot.command("filter", handleGenderFilterCommand);
  bot.command("genderfilter", handleGenderFilterCommand);

  // 1. Entry: Start VIP profile setup (starts at Step 1: Age)
  bot.action("vip_onboard_start", async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
      await renderVipStepAge(ctx);
    } catch (err) {
      console.error("vip_onboard_start error:", err);
    }
  });

  // 2. Step 1 -> Step 2: User picked age code
  bot.action(/^vip_ob_age_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
      const ageCode = ctx.match[1];
      await renderVipStepGender(ctx, ageCode);
    } catch (err) {
      console.error("vip_ob_age error:", err);
    }
  });

  // 3. Step 2 -> Step 3: User picked gender code
  bot.action(/^vip_ob_gen_(\d+)_(M|F|TM|TW|NB)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
      const ageCode = ctx.match[1];
      const genderCode = ctx.match[2];
      await renderVipStepLocation(ctx, ageCode, genderCode);
    } catch (err) {
      console.error("vip_ob_gen error:", err);
    }
  });

  // 4. Step 3 -> Step 4: User picked location code
  bot.action(/^vip_ob_loc_(\d+)_(M|F|TM|TW|NB)_([A-Z0-9]+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
      const ageCode = ctx.match[1];
      const genderCode = ctx.match[2];
      const locCode = ctx.match[3];
      await renderVipStepFilter(ctx, ageCode, genderCode, locCode);
    } catch (err) {
      console.error("vip_ob_loc error:", err);
    }
  });

  // 5. Step 4 -> Step 5: User picked filter code -> Show Review Screen with COMPLETE button!
  bot.action(/^vip_ob_rev_(\d+)_(M|F|TM|TW|NB)_([A-Z0-9]+)_(F|M|TM|ANY)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
      const ageCode = ctx.match[1];
      const genderCode = ctx.match[2];
      const locCode = ctx.match[3];
      const filterCode = ctx.match[4];
      await renderVipReviewScreen(ctx, ageCode, genderCode, locCode, filterCode);
    } catch (err) {
      console.error("vip_ob_rev error:", err);
    }
  });

  // 6. User clicked COMPLETE button! NOW AND ONLY NOW SAVE ALL DETAILS TO DATABASE!
  bot.action(/^vip_ob_done_(\d+)_(M|F|TM|TW|NB)_([A-Z0-9]+)_(F|M|TM|ANY)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery("Saving profile...").catch(() => {});
      const rawId = ctx.from?.id;
      if (!rawId) return;

      const ageCode = ctx.match[1];
      const genderCode = ctx.match[2];
      const locCode = ctx.match[3];
      const filterCode = ctx.match[4];

      const age = decodeAge(ageCode);
      const gender = decodeGender(genderCode);
      const country = decodeCountry(locCode);
      const genderFilterPreference = decodeFilter(filterCode);
      const telegramUserId = BigInt(rawId);

      // Save to database
      await saveUserSetting(telegramUserId, {
        age,
        gender,
        country,
        genderFilterPreference,
      });

      const successText =
        `🎉 <b>VIP Setup Completed &amp; Saved!</b> 👑\n\n` +
        `✅ All your profile details and match filter have been saved:\n` +
        `• <b>Your Gender:</b> ${genderLabel(genderCode)}\n` +
        `• <b>Your Age:</b> ${ageLabel(ageCode)}\n` +
        `• <b>Your Location:</b> ${countryLabel(locCode)}\n` +
        `• <b>Target Match Filter:</b> <b>${filterLabel(filterCode)}</b>\n` +
        `• <b>Match Priority:</b> ⭐ <b>80% ${filterLabel(filterCode)} / 20% Other</b>\n\n` +
        `TalkBuddy will now match you according to your 80% preference!`;

      const reply_markup = {
        inline_keyboard: [
          [
            {
              text: "🔎 Start Matching Now",
              callback_data: "menu_find",
            },
          ],
          [
            {
              text: "👑 VIP Menu",
              callback_data: "vip_info",
            },
            {
              text: "⬅️ Main Menu",
              callback_data: "back_main_menu",
            },
          ],
        ],
      };

      await safeEditOrReply(ctx, successText, reply_markup);
    } catch (err) {
      console.error("vip_ob_done error:", err);
      await ctx.reply("❌ Error saving VIP profile. Please try again.");
    }
  });

  // 7. Filter menu: User chooses a filter -> Ask to complete before saving
  bot.action(/^vip_ask_filter_(Female|Male|Trans Man|ANY)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});
      const preference = ctx.match[1];
      const label =
        preference === "Female"
          ? "Women (Female) — 80% ratio"
          : preference === "Male"
          ? "Men (Male) — 80% ratio"
          : preference === "Trans Man"
          ? "Trans — 80% ratio"
          : "Anyone (Fastest)";

      const text =
        `🎯 <b>Confirm VIP Gender Filter</b>\n\n` +
        `You selected: <b>${label}</b>\n\n` +
        `⚠️ <i>Filter will NOT be applied until you tap the Complete button below:</i>`;

      const reply_markup = {
        inline_keyboard: [
          [
            {
              text: "✅ Complete & Apply Filter",
              callback_data: `vip_save_filter_${preference}`,
            },
          ],
          [
            {
              text: "⬅️ Cancel",
              callback_data: "vip_filter_select",
            },
          ],
        ],
      };

      await safeEditOrReply(ctx, text, reply_markup);
    } catch (err) {
      console.error("vip_ask_filter error:", err);
    }
  });

  // 8. Filter menu: User clicked Complete & Apply Filter
  bot.action(/^vip_save_filter_(Female|Male|Trans Man|ANY)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery("Saving filter...").catch(() => {});
      const rawId = ctx.from?.id;
      if (!rawId) return;

      const preference = ctx.match[1];
      const telegramUserId = BigInt(rawId);

      await saveUserSetting(telegramUserId, {
        genderFilterPreference: preference,
      });

      const label =
        preference === "Female"
          ? "Women (Female) — 80% ratio"
          : preference === "Male"
          ? "Men (Male) — 80% ratio"
          : preference === "Trans Man"
          ? "Trans — 80% ratio"
          : "Anyone (Fastest)";

      const text =
        `✅ <b>VIP Gender Filter Saved!</b> 🎯\n\n` +
        `Matching Preference: <b>${label}</b>\n\n` +
        `Whenever you search for a partner, TalkBuddy will prioritize your selected filter!`;

      const reply_markup = {
        inline_keyboard: [
          [
            {
              text: "🔎 Start Matching Now",
              callback_data: "menu_find",
            },
          ],
          [
            {
              text: "👑 VIP Gender Filter Menu",
              callback_data: "vip_filter_select",
            },
            {
              text: "⬅️ Main Menu",
              callback_data: "back_main_menu",
            },
          ],
        ],
      };

      await safeEditOrReply(ctx, text, reply_markup);
    } catch (err) {
      console.error("vip_save_filter error:", err);
      await ctx.reply("❌ Error saving filter.");
    }
  });

  // Entry: Direct filter menu
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
}
