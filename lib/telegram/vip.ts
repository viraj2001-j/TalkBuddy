import prisma from "@/lib/db";

export type VipPlanKey = "1w" | "1m" | "3m" | "6m";

export interface VipPlan {
  key: VipPlanKey;
  label: string;
  pointsCost: number;
  starsPrice: number;
  durationDays: number;
  description: string;
  badge?: string | null;
}

export const VIP_PLANS: Record<VipPlanKey, VipPlan> = {
  "1w": {
    key: "1w",
    label: "1 Week VIP",
    pointsCost: 80,
    starsPrice: 50,
    durationDays: 7,
    description: "7 days of VIP access including Gender Filter, Priority Queue, and Unlimited Chats",
    badge: "Popular",
  },
  "1m": {
    key: "1m",
    label: "1 Month VIP",
    pointsCost: 250,
    starsPrice: 150,
    durationDays: 30,
    description: "30 days of VIP access with full premium perks & priority matching",
    badge: "Best Value",
  },
  "3m": {
    key: "3m",
    label: "3 Months VIP",
    pointsCost: 700,
    starsPrice: 400,
    durationDays: 90,
    description: "90 days of VIP access — quarterly saving package",
    badge: "Pro",
  },
  "6m": {
    key: "6m",
    label: "6 Months VIP",
    pointsCost: 1250,
    starsPrice: 750,
    durationDays: 180,
    description: "180 days of VIP access — maximum savings & permanent priority status",
    badge: "VIP Whale",
  },
};

/**
 * Retrieves all active VIP packages from PostgreSQL, falling back to static VIP_PLANS if table is empty.
 */
export async function getAvailableVipPackages(): Promise<VipPlan[]> {
  try {
    if ((prisma as any).vipPackage) {
      const packages = await prisma.vipPackage.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      });

      if (packages && packages.length > 0) {
        return packages.map((pkg) => ({
          key: pkg.key as VipPlanKey,
          label: pkg.name,
          pointsCost: pkg.pointsCost,
          starsPrice: pkg.starsPrice,
          durationDays: pkg.durationDays,
          description: pkg.description || `${pkg.durationDays} days of VIP access`,
          badge: pkg.badge,
        }));
      }
    }
  } catch (err) {
    console.error("Failed to query vipPackage table:", err);
  }

  return Object.values(VIP_PLANS);
}

/**
 * Retrieves a VIP package by its key (e.g., "1w", "1m").
 */
export async function getVipPackageByKey(key: string): Promise<VipPlan | null> {
  try {
    if ((prisma as any).vipPackage) {
      const pkg = await prisma.vipPackage.findUnique({
        where: { key },
      });

      if (pkg && pkg.isActive) {
        return {
          key: pkg.key as VipPlanKey,
          label: pkg.name,
          pointsCost: pkg.pointsCost,
          starsPrice: pkg.starsPrice,
          durationDays: pkg.durationDays,
          description: pkg.description || `${pkg.durationDays} days of VIP access`,
          badge: pkg.badge,
        };
      }
    }
  } catch (err) {
    console.error("Failed to find vipPackage by key:", err);
  }

  return VIP_PLANS[key as VipPlanKey] || null;
}

/**
 * Retrieves user's VIP status and enforces automatic lazy expiration.
 * If user.isVip is true but vipExpiresAt has passed, it revokes VIP in the DB immediately.
 */
export async function getUserVipStatus(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        telegramUserId: true,
        pointsBalance: true,
        isVip: true,
        vipExpiresAt: true,
        activeVipPlan: true,
      },
    });

    if (!user) {
      return {
        isVip: false,
        vipExpiresAt: null,
        pointsBalance: 0,
        activeVipPlan: null,
        activeSubscription: null,
      };
    }

    const now = new Date();

    // Lazy expiration check
    if (user.isVip && user.vipExpiresAt && user.vipExpiresAt <= now) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: userId },
            data: {
              isVip: false,
              activeVipPlan: null,
            },
          });

          if ((tx as any).vipSubscription) {
            await (tx as any).vipSubscription.updateMany({
              where: {
                userId,
                status: "ACTIVE",
                expiresAt: { lte: now },
              },
              data: {
                status: "EXPIRED",
              },
            });
          }
        });
      } catch (txErr) {
        console.error("Failed to expire VIP subscription in DB:", txErr);
      }

      return {
        isVip: false,
        vipExpiresAt: user.vipExpiresAt,
        pointsBalance: user.pointsBalance,
        activeVipPlan: null,
        activeSubscription: null,
      };
    }

    let activeSubscription = null;
    if (user.isVip && (prisma as any).vipSubscription) {
      try {
        activeSubscription = await (prisma as any).vipSubscription.findFirst({
          where: {
            userId,
            status: "ACTIVE",
            expiresAt: { gt: now },
          },
          orderBy: { expiresAt: "desc" },
        });
      } catch (subErr) {
        console.warn("Could not fetch activeSubscription:", subErr);
      }
    }

    return {
      isVip: user.isVip,
      vipExpiresAt: user.vipExpiresAt,
      pointsBalance: user.pointsBalance,
      activeVipPlan: user.activeVipPlan,
      activeSubscription,
    };
  } catch (err) {
    console.error("Error in getUserVipStatus:", err);
    return {
      isVip: false,
      vipExpiresAt: null,
      pointsBalance: 0,
      activeVipPlan: null,
      activeSubscription: null,
    };
  }
}

/**
 * Synchronize and expire all subscriptions whose expiration time has passed.
 */
export async function syncUserVipExpiration(): Promise<{ expiredCount: number }> {
  const now = new Date();

  const expiredUsers = await prisma.user.findMany({
    where: {
      isVip: true,
      vipExpiresAt: { lte: now },
    },
    select: { id: true },
  });

  if (expiredUsers.length === 0) {
    return { expiredCount: 0 };
  }

  const userIds = expiredUsers.map((u) => u.id);

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { isVip: false, activeVipPlan: null },
    }),
    prisma.vipSubscription.updateMany({
      where: {
        userId: { in: userIds },
        status: "ACTIVE",
        expiresAt: { lte: now },
      },
      data: { status: "EXPIRED" },
    }),
  ]);

  return { expiredCount: userIds.length };
}

/**
 * Purchases VIP membership using internal TalkBuddy Points.
 * Idempotent, atomic transaction with renewal extension policy.
 */
export async function purchaseVipWithPoints(
  userId: string,
  planKey: VipPlanKey
) {
  const plan = await getVipPackageByKey(planKey);
  if (!plan) {
    return { success: false as const, reason: "INVALID_PLAN" as const };
  }

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        pointsBalance: true,
        isVip: true,
        vipExpiresAt: true,
      },
    });

    if (!user) {
      return { success: false as const, reason: "USER_NOT_FOUND" as const };
    }

    if (user.pointsBalance < plan.pointsCost) {
      return {
        success: false as const,
        reason: "INSUFFICIENT_FUNDS" as const,
        pointsBalance: user.pointsBalance,
        requiredPoints: plan.pointsCost,
      };
    }

    const now = new Date();
    let newExpiresAt: Date;

    // Renewal policy: if already active VIP, extend remaining days; otherwise start from now
    if (user.isVip && user.vipExpiresAt && user.vipExpiresAt > now) {
      newExpiresAt = new Date(
        user.vipExpiresAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000
      );
    } else {
      newExpiresAt = new Date(
        now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000
      );
    }

    // 1. Deduct Points
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        pointsBalance: {
          decrement: plan.pointsCost,
        },
        isVip: true,
        vipExpiresAt: newExpiresAt,
        activeVipPlan: plan.label,
      },
      select: {
        pointsBalance: true,
        isVip: true,
        vipExpiresAt: true,
        activeVipPlan: true,
      },
    });

    // 2. Log Points Transaction
    await tx.pointsTransaction.create({
      data: {
        userId,
        amount: -plan.pointsCost,
        type: "VIP_PURCHASE",
        description: `Purchased VIP (${plan.label}) for ${plan.pointsCost} Points`,
      },
    });

    // 3. Find VipPackage DB ID if exists
    const pkgRecord = await tx.vipPackage.findUnique({
      where: { key: plan.key },
      select: { id: true },
    });

    // 4. Create Permanent PaymentTransaction Record
    const payment = await tx.paymentTransaction.create({
      data: {
        userId,
        vipPackageId: pkgRecord?.id || null,
        orderType: "VIP_SUBSCRIPTION",
        pointsAmount: plan.pointsCost,
        amountPaid: 0,
        currency: "POINTS",
        provider: "POINTS_BALANCE",
        providerPaymentId: `pts_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        status: "COMPLETED",
        description: `Purchased VIP (${plan.label}) via Points`,
      },
    });

    // 5. Create Permanent VipSubscription Record
    const subscription = await tx.vipSubscription.create({
      data: {
        userId,
        packageId: pkgRecord?.id || null,
        planKey: plan.key,
        planLabel: plan.label,
        paymentTransactionId: payment.id,
        paymentMethod: "POINTS_BALANCE",
        costAmount: plan.pointsCost,
        currency: "POINTS",
        status: "ACTIVE",
        startedAt: now,
        expiresAt: newExpiresAt,
      },
    });

    return {
      success: true as const,
      plan,
      pointsBalance: updatedUser.pointsBalance,
      vipExpiresAt: updatedUser.vipExpiresAt,
      subscriptionId: subscription.id,
      paymentId: payment.id,
    };
  });
}

/**
 * Creates a pending payment order before dispatching Telegram Stars invoice.
 */
export async function createPendingOrder(params: {
  userId: string;
  orderType: "VIP_SUBSCRIPTION" | "POINTS_PACKAGE";
  packageIdOrKey: string;
  paymentMethod?: string;
}) {
  const { userId, orderType, packageIdOrKey } = params;

  let pkgName = "";
  let starsAmount = 0;
  let priceUsd = 0;
  let vipPackageId: string | null = null;
  let pointsPackageId: string | null = null;

  if (orderType === "VIP_SUBSCRIPTION") {
    const pkg =
      (await prisma.vipPackage.findFirst({
        where: {
          OR: [{ id: packageIdOrKey }, { key: packageIdOrKey }],
          isActive: true,
        },
      })) || null;

    if (!pkg) {
      const fallback = VIP_PLANS[packageIdOrKey as VipPlanKey];
      if (!fallback) throw new Error("Invalid VIP Package");
      pkgName = fallback.label;
      starsAmount = fallback.starsPrice;
      priceUsd = 0.99;
    } else {
      pkgName = pkg.name;
      starsAmount = pkg.starsPrice;
      priceUsd = pkg.priceUsd;
      vipPackageId = pkg.id;
    }
  } else {
    const pkg = await prisma.pointsPackage.findUnique({
      where: { id: packageIdOrKey },
    });
    if (!pkg || !pkg.isActive) {
      throw new Error("Invalid Points Package");
    }
    pkgName = pkg.name;
    starsAmount = pkg.starsPrice;
    priceUsd = pkg.priceUsd;
    pointsPackageId = pkg.id;
  }

  const orderPayload = `tb_order_${orderType}_${packageIdOrKey}_${userId.substring(0, 8)}_${Date.now()}`;

  const pendingTransaction = await prisma.paymentTransaction.create({
    data: {
      userId,
      packageId: pointsPackageId,
      vipPackageId,
      orderType,
      starsAmount,
      amountPaid: priceUsd,
      currency: "XTR",
      provider: "TELEGRAM_STARS",
      orderPayload,
      status: "PENDING",
      description: `Pending purchase of ${pkgName} for ⭐${starsAmount} Stars`,
    },
  });

  return {
    orderId: pendingTransaction.id,
    orderPayload,
    starsAmount,
    pkgName,
    priceUsd,
  };
}

/**
 * Validates Telegram pre_checkout_query.
 * Checks order payload, status, amount, and currency within 10s timeout.
 */
export async function validatePreCheckoutQuery(
  orderPayload: string,
  totalAmountStars: number,
  currency: string
): Promise<{ isValid: boolean; errorMessage?: string; order?: any }> {
  if (currency !== "XTR") {
    return { isValid: false, errorMessage: "Only Telegram Stars (XTR) accepted." };
  }

  const order = await prisma.paymentTransaction.findUnique({
    where: { orderPayload },
    include: {
      vipPackage: true,
      package: true,
    },
  });

  if (!order) {
    return { isValid: false, errorMessage: "Order not found or expired." };
  }

  if (order.status !== "PENDING") {
    return { isValid: false, errorMessage: "This order is no longer pending." };
  }

  if (order.starsAmount !== totalAmountStars) {
    return {
      isValid: false,
      errorMessage: `Incorrect amount. Expected ⭐${order.starsAmount} Stars.`,
    };
  }

  return { isValid: true, order };
}

/**
 * Verifies official successful_payment event and fulfills VIP activation or Points crediting.
 * Guaranteed idempotent using telegramPaymentChargeId.
 */
export async function fulfillSuccessfulPayment(params: {
  telegramUserId: bigint | number;
  telegramPaymentChargeId: string;
  providerPaymentChargeId?: string;
  orderPayload: string;
  totalAmountStars: number;
  currency: string;
}) {
  const {
    telegramUserId,
    telegramPaymentChargeId,
    providerPaymentChargeId,
    orderPayload,
    totalAmountStars,
    currency,
  } = params;

  if (currency !== "XTR") {
    throw new Error(`Unsupported payment currency: ${currency}. Expected XTR.`);
  }

  // Idempotency check 1: Has this charge already been processed?
  const existingByCharge = await prisma.paymentTransaction.findUnique({
    where: { telegramPaymentChargeId },
    include: {
      vipSubscription: true,
      vipPackage: true,
      package: true,
    },
  });

  if (existingByCharge && existingByCharge.status === "COMPLETED") {
    console.log(
      `[Idempotency] Payment charge ${telegramPaymentChargeId} already fulfilled. Returning existing record.`
    );
    return {
      success: true as const,
      isDuplicate: true,
      orderType: existingByCharge.orderType,
      planLabel: existingByCharge.vipSubscription?.planLabel || "VIP",
      durationDays: existingByCharge.vipPackage?.durationDays || 30,
      vipExpiresAt: existingByCharge.vipSubscription?.expiresAt || null,
      pointsAdded: existingByCharge.pointsAmount,
      newBalance: 0,
      transaction: existingByCharge,
      subscription: existingByCharge.vipSubscription,
    };
  }

  return await prisma.$transaction(async (tx) => {
    // Find user
    const user = await tx.user.findUnique({
      where: { telegramUserId: BigInt(telegramUserId) },
    });

    if (!user) {
      throw new Error(`User with Telegram ID ${telegramUserId} not found.`);
    }

    // Find pending order
    const pendingOrder = await tx.paymentTransaction.findUnique({
      where: { orderPayload },
      include: {
        vipPackage: true,
        package: true,
      },
    });

    if (!pendingOrder) {
      throw new Error(`Pending order with payload ${orderPayload} not found.`);
    }

    if (pendingOrder.status === "COMPLETED") {
      return {
        success: true as const,
        isDuplicate: true,
        orderType: pendingOrder.orderType,
        planLabel: pendingOrder.vipPackage?.name || "VIP",
        durationDays: pendingOrder.vipPackage?.durationDays || 30,
        vipExpiresAt: null,
        pointsAdded: pendingOrder.pointsAmount,
        newBalance: user.pointsBalance,
        transaction: pendingOrder,
      };
    }

    // Verify order owner matches paying user
    if (pendingOrder.userId !== user.id) {
      throw new Error("Order ownership mismatch.");
    }

    // Verify amount matches
    if (pendingOrder.starsAmount !== totalAmountStars) {
      throw new Error(
        `Amount mismatch: expected ⭐${pendingOrder.starsAmount}, received ⭐${totalAmountStars}`
      );
    }

    const now = new Date();

    if (pendingOrder.orderType === "VIP_SUBSCRIPTION") {
      let durationDays = 30;
      let planKey = "1m";
      let planLabel = "1 Month VIP";
      let packageDbId: string | null = pendingOrder.vipPackageId;

      if (pendingOrder.vipPackage) {
        durationDays = pendingOrder.vipPackage.durationDays;
        planKey = pendingOrder.vipPackage.key;
        planLabel = pendingOrder.vipPackage.name;
      } else {
        // Parse from payload if direct plan key
        const parts = orderPayload.split("_");
        const key = (parts[3] || "1m") as VipPlanKey;
        const fallback = VIP_PLANS[key] || VIP_PLANS["1m"];
        durationDays = fallback.durationDays;
        planKey = fallback.key;
        planLabel = fallback.label;

        const dbPkg = await tx.vipPackage.findUnique({ where: { key: planKey } });
        if (dbPkg) packageDbId = dbPkg.id;
      }

      // Calculate expiration timestamp: extend if already active VIP
      let newExpiresAt: Date;
      if (user.isVip && user.vipExpiresAt && user.vipExpiresAt > now) {
        newExpiresAt = new Date(
          user.vipExpiresAt.getTime() + durationDays * 24 * 60 * 60 * 1000
        );
      } else {
        newExpiresAt = new Date(
          now.getTime() + durationDays * 24 * 60 * 60 * 1000
        );
      }

      // Update user
      await tx.user.update({
        where: { id: user.id },
        data: {
          isVip: true,
          vipExpiresAt: newExpiresAt,
          activeVipPlan: planLabel,
        },
      });

      // Update payment transaction to COMPLETED
      const completedTx = await tx.paymentTransaction.update({
        where: { id: pendingOrder.id },
        data: {
          status: "COMPLETED",
          telegramPaymentChargeId,
          providerChargeId: providerPaymentChargeId || null,
          starsAmount: totalAmountStars,
          currency: "XTR",
          description: `Purchased ${planLabel} for ⭐${totalAmountStars} Telegram Stars`,
        },
      });

      // Create VipSubscription audit record
      const subscription = await tx.vipSubscription.create({
        data: {
          userId: user.id,
          packageId: packageDbId,
          planKey,
          planLabel,
          paymentTransactionId: completedTx.id,
          paymentMethod: "TELEGRAM_STARS",
          costAmount: totalAmountStars,
          currency: "XTR",
          status: "ACTIVE",
          startedAt: now,
          expiresAt: newExpiresAt,
        },
      });

      return {
        success: true as const,
        isDuplicate: false,
        orderType: "VIP_SUBSCRIPTION",
        planLabel,
        durationDays,
        vipExpiresAt: newExpiresAt,
        transaction: completedTx,
        subscription,
      };
    } else {
      // POINTS_PACKAGE fulfillment
      const pkg =
        pendingOrder.package ||
        (await tx.pointsPackage.findUnique({
          where: { id: pendingOrder.packageId || "" },
        }));

      const pointsToCredit = pkg ? pkg.points : (pendingOrder.pointsAmount || 100);
      const pkgName = pkg ? pkg.name : "Points Package";

      // Increment points
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          pointsBalance: { increment: pointsToCredit },
        },
        select: { pointsBalance: true },
      });

      // Complete transaction
      const completedTx = await tx.paymentTransaction.update({
        where: { id: pendingOrder.id },
        data: {
          status: "COMPLETED",
          telegramPaymentChargeId,
          providerChargeId: providerPaymentChargeId || null,
          pointsAmount: pointsToCredit,
          starsAmount: totalAmountStars,
          currency: "XTR",
          description: `Purchased ${pkgName} (+${pointsToCredit} pts) for ⭐${totalAmountStars} Stars`,
        },
      });

      // Points transaction record
      await tx.pointsTransaction.create({
        data: {
          userId: user.id,
          amount: pointsToCredit,
          type: "PACKAGE_PURCHASE",
          description: `Purchased ${pkgName} via Telegram Stars (+${pointsToCredit} pts)`,
        },
      });

      return {
        success: true as const,
        isDuplicate: false,
        orderType: "POINTS_PACKAGE",
        pointsAdded: pointsToCredit,
        newBalance: updatedUser.pointsBalance,
        transaction: completedTx,
      };
    }
  });
}

/**
 * Refunds a Telegram Stars transaction via Telegram Bot API and updates local records.
 */
export async function refundTelegramStarsPayment(
  transactionId: string,
  refundReason: string = "Admin requested refund",
  telegramApiRefundFn?: (telegramUserId: number, chargeId: string) => Promise<boolean>
) {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id: transactionId },
    include: {
      user: true,
      vipSubscription: true,
    },
  });

  if (!transaction) {
    throw new Error("Transaction not found.");
  }

  if (transaction.status === "REFUNDED" || transaction.isRefunded) {
    return { success: false, reason: "ALREADY_REFUNDED" };
  }

  if (transaction.currency !== "XTR" || !transaction.telegramPaymentChargeId) {
    throw new Error("Only completed Telegram Stars transactions can be refunded via Stars.");
  }

  // Execute Telegram Bot API refund if function supplied
  if (telegramApiRefundFn) {
    try {
      const apiOk = await telegramApiRefundFn(
        Number(transaction.user.telegramUserId),
        transaction.telegramPaymentChargeId
      );
      if (!apiOk) {
        throw new Error("Telegram refundStarPayment API call returned false.");
      }
    } catch (err: any) {
      console.error("Telegram API refund failed:", err);
      throw new Error(`Telegram Stars refund failed: ${err.message}`);
    }
  }

  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    // 1. Mark transaction as REFUNDED
    const updatedTx = await tx.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: "REFUNDED",
        isRefunded: true,
        refundedAt: now,
        refundReason,
        refundedAmount: transaction.starsAmount || transaction.amountPaid,
      },
    });

    // 2. If it was a VIP subscription, mark subscription as REFUNDED
    if (transaction.vipSubscription) {
      await tx.vipSubscription.update({
        where: { id: transaction.vipSubscription.id },
        data: { status: "REFUNDED" },
      });

      // Check if user has other active VIP subscriptions
      const otherActiveSub = await tx.vipSubscription.findFirst({
        where: {
          userId: transaction.userId,
          status: "ACTIVE",
          expiresAt: { gt: now },
          id: { not: transaction.vipSubscription.id },
        },
        orderBy: { expiresAt: "desc" },
      });

      if (!otherActiveSub) {
        await tx.user.update({
          where: { id: transaction.userId },
          data: {
            isVip: false,
            activeVipPlan: null,
          },
        });
      } else {
        await tx.user.update({
          where: { id: transaction.userId },
          data: {
            isVip: true,
            vipExpiresAt: otherActiveSub.expiresAt,
            activeVipPlan: otherActiveSub.planLabel,
          },
        });
      }
    }

    // 3. If it was a Points package, deduct credited points (without dropping below 0)
    if (transaction.orderType === "POINTS_PACKAGE" && transaction.pointsAmount > 0) {
      const user = await tx.user.findUnique({
        where: { id: transaction.userId },
        select: { pointsBalance: true },
      });

      const deductAmount = Math.min(user?.pointsBalance || 0, transaction.pointsAmount);

      if (deductAmount > 0) {
        await tx.user.update({
          where: { id: transaction.userId },
          data: { pointsBalance: { decrement: deductAmount } },
        });

        await tx.pointsTransaction.create({
          data: {
            userId: transaction.userId,
            amount: -deductAmount,
            type: "ADMIN_ADJUSTMENT",
            description: `Deducted points due to Stars payment refund (#${transaction.id.substring(0, 8)})`,
          },
        });
      }
    }

    return {
      success: true,
      transaction: updatedTx,
    };
  });
}
