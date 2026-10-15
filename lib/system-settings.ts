import prisma from "@/lib/db";

export const DEFAULT_SETTINGS: Record<string, { value: string; category: string; description: string }> = {
  WELCOME_POINTS: {
    value: "100",
    category: "ECONOMY",
    description: "Points awarded to new users upon account registration",
  },
  DAILY_REWARD_POINTS: {
    value: "25",
    category: "ECONOMY",
    description: "Points awarded every 24 hours via /earn daily reward",
  },
  REFERRAL_BONUS_REFERRER: {
    value: "50",
    category: "ECONOMY",
    description: "Bonus points credited to referrer when a friend joins",
  },
  REFERRAL_BONUS_NEW_USER: {
    value: "25",
    category: "ECONOMY",
    description: "Bonus points credited to referee when joining via invite link",
  },
  CHAT_COMPLETION_BONUS: {
    value: "5",
    category: "ECONOMY",
    description: "Points awarded to both partners upon completing a normal chat session",
  },
  SAVE_PARTNER_COST: {
    value: "10",
    category: "ECONOMY",
    description: "Points required to save a previous partner's nickname",
  },
  MAINTENANCE_MODE: {
    value: "false",
    category: "MAINTENANCE",
    description: "When true, new matching is paused and users are informed",
  },
  GLOBAL_ANNOUNCEMENT: {
    value: "Welcome to TalkBuddy! Chat anonymously and earn daily points.",
    category: "GENERAL",
    description: "Announcement banner displayed on landing page and bot status",
  },
  BOT_WELCOME_MESSAGE: {
    value: "👋 Welcome to TalkBuddy! Meet new anonymous friends and earn points.",
    category: "GENERAL",
    description: "Greeting text sent to users upon /start",
  },
};

/**
 * Initializes missing system settings with default values.
 */
export async function ensureSystemSettingsInitialized() {
  try {
    for (const [key, data] of Object.entries(DEFAULT_SETTINGS)) {
      await prisma.systemSetting.upsert({
        where: { key },
        update: {},
        create: {
          key,
          value: data.value,
          category: data.category,
          description: data.description,
        },
      });
    }
  } catch (err) {
    console.error("Failed to initialize system settings:", err);
  }
}

/**
 * Get a specific system setting as string or number.
 */
export async function getSystemSetting(key: string, fallback?: string): Promise<string> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    if (setting) return setting.value;
  } catch (err) {
    console.error(`Failed to fetch setting ${key}:`, err);
  }
  return fallback ?? DEFAULT_SETTINGS[key]?.value ?? "";
}

/**
 * Get an integer system setting.
 */
export async function getSystemIntSetting(key: string, fallback?: number): Promise<number> {
  const val = await getSystemSetting(key);
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? (fallback ?? parseInt(DEFAULT_SETTINGS[key]?.value ?? "0", 10)) : parsed;
}

/**
 * Audit log helper for admin operations.
 */
export async function logAdminAction(
  action: string,
  details?: Record<string, any> | string,
  targetId?: string,
  actorId: string = "ADMIN"
) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        action,
        actorId,
        targetId,
        details: typeof details === "object" ? JSON.stringify(details) : details,
      },
    });
  } catch (err) {
    console.error("Failed to log admin action:", err);
  }
}
