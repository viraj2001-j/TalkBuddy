import prisma from "@/lib/db";
import { PointsTransactionType } from "@/app/generated/prisma/client";
import { getSystemIntSetting } from "@/lib/system-settings";

export const SAVE_PARTNER_COST = 10;
export const WELCOME_POINTS = 100;
export const DAILY_REWARD_POINTS = 25;
export const REFERRAL_BONUS_REFERRER = 50;
export const REFERRAL_BONUS_NEW_USER = 25;
export const CHAT_COMPLETION_BONUS = 5;

/**
 * Get the current Points balance of a user.
 */
export async function getPointsBalance(userId: string) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      pointsBalance: true,
    },
  });

  return user?.pointsBalance ?? 0;
}

/**
 * Add Points to a user's balance.
 */
export async function addPoints(
  userId: string,
  amount: number,
  type: PointsTransactionType,
  description?: string
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Points amount must be a positive integer.");
  }

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: {
        id: userId,
      },
      data: {
        pointsBalance: {
          increment: amount,
        },
      },
      select: {
        pointsBalance: true,
      },
    });

    await tx.pointsTransaction.create({
      data: {
        userId,
        amount,
        type,
        description,
      },
    });

    return user.pointsBalance;
  });
}

/**
 * Spend Points from a user's balance.
 *
 * The balance check and deduction happen inside
 * one database transaction to prevent race conditions.
 */
export async function spendPoints(
  userId: string,
  amount: number,
  type: PointsTransactionType,
  description?: string
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Points amount must be a positive integer.");
  }

  return await prisma.$transaction(
    async (tx) => {
      const result = await tx.user.updateMany({
        where: {
          id: userId,
          pointsBalance: {
            gte: amount,
          },
        },
        data: {
          pointsBalance: {
            decrement: amount,
          },
        },
      });

      if (result.count !== 1) {
        return {
          success: false,
          balance: null,
          reason: "INSUFFICIENT_FUNDS",
        };
      }

      const user = await tx.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          pointsBalance: true,
        },
      });

      await tx.pointsTransaction.create({
        data: {
          userId,
          amount: -amount,
          type,
          description,
        },
      });

      return {
        success: true,
        balance: user?.pointsBalance ?? 0,
      };
    },
    {
      timeout: 30000,
      maxWait: 10000,
    }
  );
}

/**
 * Claim daily point reward (once every 24 hours).
 * Atomic conditional update to eliminate race conditions.
 */
export async function claimDailyReward(userId: string) {
  const now = new Date();
  const cooldownThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rewardAmount = await getSystemIntSetting("DAILY_REWARD_POINTS", DAILY_REWARD_POINTS);

  return await prisma.$transaction(async (tx) => {
    // Atomically increment ONLY if cooldown has passed or first time claiming
    const updateResult = await tx.user.updateMany({
      where: {
        id: userId,
        OR: [
          { lastDailyRewardAt: null },
          { lastDailyRewardAt: { lte: cooldownThreshold } },
        ],
      },
      data: {
        pointsBalance: {
          increment: rewardAmount,
        },
        lastDailyRewardAt: now,
      },
    });

    if (updateResult.count !== 1) {
      // Either user does not exist or cooldown is active
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { lastDailyRewardAt: true },
      });

      if (!user) {
        return { success: false as const, reason: "USER_NOT_FOUND" as const };
      }

      const elapsedMs = user.lastDailyRewardAt
        ? now.getTime() - user.lastDailyRewardAt.getTime()
        : 0;
      const cooldownMs = 24 * 60 * 60 * 1000;
      const remainingHours = Math.max(1, Math.ceil((cooldownMs - elapsedMs) / (60 * 60 * 1000)));

      return {
        success: false as const,
        reason: "COOLDOWN_ACTIVE" as const,
        remainingHours,
      };
    }

    const updatedUser = await tx.user.findUnique({
      where: { id: userId },
      select: { pointsBalance: true },
    });

    await tx.pointsTransaction.create({
      data: {
        userId,
        amount: rewardAmount,
        type: "DAILY_REWARD",
        description: `Claimed daily reward bonus (+${rewardAmount} pts)`,
      },
    });

    return {
      success: true as const,
      rewardPoints: rewardAmount,
      newBalance: updatedUser?.pointsBalance ?? 0,
    };
  });
}

/**
 * Process referral code when a user signs up with a ref link.
 * Atomic conditional update ensures idempotency.
 */
export async function processReferral(newUserId: string, referralCode: string) {
  const cleanCode = referralCode.trim();
  if (!cleanCode) return { success: false, reason: "INVALID_CODE" };

  const refBonusReferrer = await getSystemIntSetting("REFERRAL_BONUS_REFERRER", REFERRAL_BONUS_REFERRER);
  const refBonusNewUser = await getSystemIntSetting("REFERRAL_BONUS_NEW_USER", REFERRAL_BONUS_NEW_USER);

  return await prisma.$transaction(async (tx) => {
    const referrer = await tx.user.findFirst({
      where: { referralCode: cleanCode },
      select: { id: true, pointsBalance: true },
    });

    if (!referrer || referrer.id === newUserId) {
      return { success: false, reason: "REFERRER_NOT_FOUND" };
    }

    // Atomically link ONLY if not already referred
    const linkResult = await tx.user.updateMany({
      where: {
        id: newUserId,
        referredById: null,
      },
      data: {
        referredById: referrer.id,
        pointsBalance: { increment: refBonusNewUser },
      },
    });

    if (linkResult.count !== 1) {
      return { success: false, reason: "ALREADY_REFERRED" };
    }

    // Credit bonus to referrer
    await tx.user.update({
      where: { id: referrer.id },
      data: {
        pointsBalance: { increment: refBonusReferrer },
      },
    });

    // Log transaction for referrer
    await tx.pointsTransaction.create({
      data: {
        userId: referrer.id,
        amount: refBonusReferrer,
        type: "REFERRAL",
        description: `Referral bonus: invited a new friend (+${refBonusReferrer} pts)`,
      },
    });

    // Log transaction for new user
    await tx.pointsTransaction.create({
      data: {
        userId: newUserId,
        amount: refBonusNewUser,
        type: "REFERRAL",
        description: `Welcome referral bonus from joining (+${refBonusNewUser} pts)`,
      },
    });

    return { success: true, referrerId: referrer.id };
  });
}

/**
 * Reward chat activity points upon chat completion.
 */
export async function rewardChatCompletion(userId: string) {
  try {
    const chatBonus = await getSystemIntSetting("CHAT_COMPLETION_BONUS", CHAT_COMPLETION_BONUS);
    return await addPoints(
      userId,
      chatBonus,
      "CHAT_EARNING",
      `Active chat bonus (+${chatBonus} pts)`
    );
  } catch (err) {
    console.error("Failed to reward chat completion points:", err);
  }
}

/**
 * Process purchase of a Points Package.
 */
export async function processPackagePayment(
  userId: string,
  packageId: string,
  provider: string = "TELEGRAM_STARS",
  providerPaymentId?: string
) {
  const pkg = await prisma.pointsPackage.findUnique({
    where: { id: packageId },
  });

  if (!pkg || !pkg.isActive) {
    return { success: false as const, reason: "PACKAGE_NOT_FOUND" as const };
  }

  return await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        pointsBalance: { increment: pkg.points },
      },
      select: { pointsBalance: true },
    });

    const payment = await tx.paymentTransaction.create({
      data: {
        userId,
        packageId: pkg.id,
        pointsAmount: pkg.points,
        amountPaid: pkg.priceUsd,
        currency: "USD",
        provider,
        providerPaymentId: providerPaymentId || `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        status: "COMPLETED",
        description: `Purchased ${pkg.name} (${pkg.points} pts)`,
      },
    });

    await tx.pointsTransaction.create({
      data: {
        userId,
        amount: pkg.points,
        type: "PACKAGE_PURCHASE",
        description: `Purchased ${pkg.name} package (+${pkg.points} pts)`,
      },
    });

    return {
      success: true as const,
      pointsAdded: pkg.points,
      newBalance: updatedUser.pointsBalance,
      paymentId: payment.id,
      pkg,
    };
  });
}