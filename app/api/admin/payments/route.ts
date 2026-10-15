import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { refundTelegramStarsPayment } from "@/lib/telegram/vip";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const currency = searchParams.get("currency");
    const orderType = searchParams.get("orderType");
    const search = searchParams.get("search");

    const now = new Date();

    // 1. Calculate Comprehensive Financial & Membership Metrics
    const allTransactions = await prisma.paymentTransaction.findMany({
      select: {
        id: true,
        status: true,
        currency: true,
        starsAmount: true,
        amountPaid: true,
        orderType: true,
        packageId: true,
        vipPackageId: true,
      },
    });

    const completedTx = allTransactions.filter((t) => t.status === "COMPLETED");
    const refundedTx = allTransactions.filter((t) => t.status === "REFUNDED");
    const pendingTx = allTransactions.filter((t) => t.status === "PENDING");
    const failedTx = allTransactions.filter((t) => t.status === "FAILED");

    // Telegram Stars (XTR) Metrics
    const grossStarsReceived = completedTx
      .filter((t) => t.currency === "XTR")
      .reduce((sum, t) => sum + (t.starsAmount || 0), 0);

    const refundedStars = refundedTx
      .filter((t) => t.currency === "XTR")
      .reduce((sum, t) => sum + (t.starsAmount || 0), 0);

    const netStarsRetained = Math.max(0, grossStarsReceived - refundedStars);

    // USD Cash Metrics (if any non-Stars cash gateway used)
    const grossUsdVolume = completedTx
      .filter((t) => t.currency === "USD")
      .reduce((sum, t) => sum + (t.amountPaid || 0), 0);

    // Active & Expired VIP Subscriptions
    const [activeVipSubs, expiredVipSubs] = await Promise.all([
      prisma.vipSubscription.count({
        where: {
          status: "ACTIVE",
          expiresAt: { gt: now },
        },
      }),
      prisma.vipSubscription.count({
        where: {
          OR: [
            { status: { in: ["EXPIRED", "REFUNDED", "CANCELLED"] } },
            { expiresAt: { lte: now } },
          ],
        },
      }),
    ]);

    // 2. Fetch Packages Catalogs
    const [pointsPackages, vipPackages] = await Promise.all([
      prisma.pointsPackage.findMany({
        orderBy: { points: "asc" },
        include: { _count: { select: { payments: true } } },
      }),
      prisma.vipPackage.findMany({
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { payments: true, subscriptions: true } },
        },
      }),
    ]);

    // 3. Filter Transactions
    const txWhere: any = {};
    if (status) txWhere.status = status;
    if (currency) txWhere.currency = currency;
    if (orderType) txWhere.orderType = orderType;

    if (search) {
      txWhere.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { telegramPaymentChargeId: { contains: search, mode: "insensitive" } },
        { orderPayload: { contains: search, mode: "insensitive" } },
        {
          user: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { username: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const transactions = await prisma.paymentTransaction.findMany({
      where: txWhere,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            telegramUserId: true,
            firstName: true,
            username: true,
            pointsBalance: true,
          },
        },
        package: {
          select: {
            id: true,
            name: true,
            points: true,
            starsPrice: true,
          },
        },
        vipPackage: {
          select: {
            id: true,
            key: true,
            name: true,
            durationDays: true,
            starsPrice: true,
          },
        },
        vipSubscription: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            expiresAt: true,
          },
        },
      },
    });

    const serializedTransactions = transactions.map((t) => ({
      ...t,
      user: {
        ...t.user,
        telegramUserId: t.user.telegramUserId.toString(),
      },
    }));

    return NextResponse.json({
      success: true,
      metrics: {
        totalTransactions: allTransactions.length,
        completedCount: completedTx.length,
        pendingCount: pendingTx.length,
        refundedCount: refundedTx.length,
        failedCount: failedTx.length,
        grossStarsReceived,
        refundedStars,
        netStarsRetained,
        grossUsdVolume,
        activeVipSubscriptions: activeVipSubs,
        expiredVipSubscriptions: expiredVipSubs,
      },
      packages: pointsPackages,
      vipPackages,
      transactions: serializedTransactions,
    });
  } catch (error: any) {
    console.error("Admin payments GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // Action: Refund a Transaction (Telegram Stars or Manual)
    if (action === "refund_transaction") {
      const { transactionId, reason } = body;
      if (!transactionId) {
        return NextResponse.json(
          { success: false, error: "transactionId is required" },
          { status: 400 }
        );
      }

      const tx = await prisma.paymentTransaction.findUnique({
        where: { id: transactionId },
        include: { user: true },
      });

      if (!tx) {
        return NextResponse.json(
          { success: false, error: "Transaction not found" },
          { status: 404 }
        );
      }

      if (tx.currency === "XTR" && tx.telegramPaymentChargeId) {
        // Invoke official Telegram Stars refund
        const refundResult = await refundTelegramStarsPayment(
          transactionId,
          reason || "Admin issued refund",
          async (telegramUserId, chargeId) => {
            const token = process.env.TELEGRAM_BOT_TOKEN;
            if (!token || token.includes("fake")) return true; // testing mock
            try {
              const res = await fetch(
                `https://api.telegram.org/bot${token}/refundStarPayment`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    user_id: telegramUserId,
                    telegram_payment_charge_id: chargeId,
                  }),
                }
              );
              const data = await res.json();
              return Boolean(data && data.ok);
            } catch (err) {
              console.error("Telegram Stars API refund call error:", err);
              return false;
            }
          }
        );

        return NextResponse.json({
          success: true,
          message: "Telegram Stars refunded and VIP status updated.",
          result: refundResult,
        });
      } else {
        // Manual/other currency refund
        const updated = await prisma.paymentTransaction.update({
          where: { id: transactionId },
          data: {
            status: "REFUNDED",
            isRefunded: true,
            refundedAt: new Date(),
            refundReason: reason || "Manual refund by admin",
            refundedAmount: tx.amountPaid,
          },
        });

        return NextResponse.json({
          success: true,
          message: "Transaction marked as REFUNDED.",
          transaction: updated,
        });
      }
    }

    // Action: Create Points Package
    if (action === "create_package") {
      const { name, description, points, priceUsd, starsPrice, badge, isActive } =
        body;

      if (!name || !points || typeof points !== "number") {
        return NextResponse.json(
          { success: false, error: "Package name and points amount are required" },
          { status: 400 }
        );
      }

      const newPkg = await prisma.pointsPackage.create({
        data: {
          name,
          description: description || null,
          points,
          priceUsd: Number(priceUsd) || 0.99,
          starsPrice: Number(starsPrice) || 50,
          badge: badge || null,
          isActive: isActive !== undefined ? !!isActive : true,
        },
      });

      return NextResponse.json({ success: true, package: newPkg });
    }

    // Action: Create VIP Package
    if (action === "create_vip_package") {
      const {
        key,
        name,
        description,
        durationDays,
        pointsCost,
        starsPrice,
        priceUsd,
        badge,
        features,
        isActive,
      } = body;

      if (!key || !name || !durationDays) {
        return NextResponse.json(
          { success: false, error: "Key, name, and durationDays are required" },
          { status: 400 }
        );
      }

      const newVipPkg = await prisma.vipPackage.create({
        data: {
          key: key.toLowerCase().trim(),
          name,
          description: description || null,
          durationDays: Number(durationDays),
          pointsCost: Number(pointsCost) || 100,
          starsPrice: Number(starsPrice) || 50,
          priceUsd: Number(priceUsd) || 0.99,
          badge: badge || null,
          features: features || "Gender Filter,Priority Matching,Unlimited Chats",
          isActive: isActive !== undefined ? !!isActive : true,
        },
      });

      return NextResponse.json({ success: true, vipPackage: newVipPkg });
    }

    // Action: Manual Payment Credit
    if (action === "manual_payment") {
      const { userId, pointsAmount, amountPaid, provider, description } = body;

      if (!userId || !pointsAmount) {
        return NextResponse.json(
          { success: false, error: "userId and pointsAmount are required" },
          { status: 400 }
        );
      }

      const payment = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { pointsBalance: { increment: pointsAmount } },
        });

        const newPay = await tx.paymentTransaction.create({
          data: {
            userId,
            orderType: "MANUAL_CREDIT",
            pointsAmount,
            amountPaid: Number(amountPaid) || 0,
            currency: "USD",
            provider: provider || "MANUAL_ADMIN",
            providerPaymentId: `adm_${Date.now()}`,
            status: "COMPLETED",
            description: description || "Manual points adjustment by Admin",
          },
        });

        await tx.pointsTransaction.create({
          data: {
            userId,
            amount: pointsAmount,
            type: "ADMIN_ADJUSTMENT",
            description: description || "Admin credit / manual adjustment",
          },
        });

        return newPay;
      });

      return NextResponse.json({ success: true, payment });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Admin payments POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // Update Points Package
    if (action === "update_package") {
      const { packageId, action: _action, ...updates } = body;
      const updated = await prisma.pointsPackage.update({
        where: { id: packageId },
        data: updates,
      });
      return NextResponse.json({ success: true, package: updated });
    }

    // Update VIP Package
    if (action === "update_vip_package") {
      const { vipPackageId, action: _action, ...updates } = body;
      const updated = await prisma.vipPackage.update({
        where: { id: vipPackageId },
        data: updates,
      });
      return NextResponse.json({ success: true, vipPackage: updated });
    }

    // Update Transaction Status
    if (action === "update_transaction") {
      const { transactionId, status } = body;
      const updated = await prisma.paymentTransaction.update({
        where: { id: transactionId },
        data: { status },
      });
      return NextResponse.json({ success: true, transaction: updated });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const packageId = searchParams.get("packageId");
    const vipPackageId = searchParams.get("vipPackageId");

    if (packageId) {
      await prisma.pointsPackage.delete({ where: { id: packageId } });
      return NextResponse.json({ success: true, message: "Points package deleted" });
    }

    if (vipPackageId) {
      await prisma.vipPackage.delete({ where: { id: vipPackageId } });
      return NextResponse.json({ success: true, message: "VIP package deleted" });
    }

    return NextResponse.json(
      { success: false, error: "packageId or vipPackageId required" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
