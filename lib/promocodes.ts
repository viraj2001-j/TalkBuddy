import prisma from "@/lib/db";

export async function ensureDefaultPromoCodes() {
  try {
    const existing = await prisma.promoCode.findFirst();
    if (!existing) {
      await prisma.promoCode.createMany({
        data: [
          {
            code: "TALKBUDDY",
            pointsReward: 100,
            vipDaysReward: 0,
            maxUses: 1000,
          },
          {
            code: "VIPFREE",
            pointsReward: 50,
            vipDaysReward: 3,
            maxUses: 500,
          },
          {
            code: "PREMIUM2026",
            pointsReward: 150,
            vipDaysReward: 7,
            maxUses: 200,
          },
        ],
        skipDuplicates: true,
      });
    }
  } catch (err) {
    console.error("Failed to seed promo codes:", err);
  }
}

export async function redeemPromoCode(userId: string, rawCode: string) {
  const code = rawCode.trim().toUpperCase();

  return await prisma.$transaction(async (tx) => {
    const promo = await tx.promoCode.findUnique({
      where: { code },
    });

    if (!promo || !promo.isActive) {
      return { success: false, reason: "INVALID_CODE" };
    }

    if (promo.expiresAt && promo.expiresAt < new Date()) {
      return { success: false, reason: "EXPIRED" };
    }

    if (promo.usedCount >= promo.maxUses) {
      return { success: false, reason: "MAX_USES_REACHED" };
    }

    const alreadyRedeemed = await tx.promoCodeRedemption.findUnique({
      where: {
        promoCodeId_userId: {
          promoCodeId: promo.id,
          userId,
        },
      },
    });

    if (alreadyRedeemed) {
      return { success: false, reason: "ALREADY_REDEEMED" };
    }

    await tx.promoCodeRedemption.create({
      data: {
        promoCodeId: promo.id,
        userId,
      },
    });

    await tx.promoCode.update({
      where: { id: promo.id },
      data: {
        usedCount: { increment: 1 },
      },
    });

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { pointsBalance: true, isVip: true, vipExpiresAt: true },
    });

    if (!user) {
      return { success: false, reason: "USER_NOT_FOUND" };
    }

    let newExpiresAt = user.vipExpiresAt;
    let becameVip = false;

    if (promo.vipDaysReward > 0) {
      const now = new Date();
      if (user.isVip && user.vipExpiresAt && user.vipExpiresAt > now) {
        newExpiresAt = new Date(
          user.vipExpiresAt.getTime() + promo.vipDaysReward * 24 * 60 * 60 * 1000
        );
      } else {
        newExpiresAt = new Date(
          now.getTime() + promo.vipDaysReward * 24 * 60 * 60 * 1000
        );
      }
      becameVip = true;
    }

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        pointsBalance: {
          increment: promo.pointsReward,
        },
        ...(becameVip
          ? {
              isVip: true,
              vipExpiresAt: newExpiresAt,
              activeVipPlan: `Promo Pass (${promo.vipDaysReward}d)`,
            }
          : {}),
      },
      select: {
        pointsBalance: true,
        isVip: true,
        vipExpiresAt: true,
      },
    });

    if (promo.pointsReward > 0) {
      await tx.pointsTransaction.create({
        data: {
          userId,
          amount: promo.pointsReward,
          type: "PROMO_CODE",
          description: `Redeemed promo code: ${code}`,
        },
      });
    }

    return {
      success: true,
      pointsReward: promo.pointsReward,
      vipDaysReward: promo.vipDaysReward,
      newPointsBalance: updatedUser.pointsBalance,
      isVip: updatedUser.isVip,
      vipExpiresAt: updatedUser.vipExpiresAt,
    };
  });
}
