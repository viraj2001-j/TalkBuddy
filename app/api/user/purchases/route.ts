import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserVipStatus } from "@/lib/telegram/vip";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramUserIdStr = searchParams.get("telegramUserId");
    const userId = searchParams.get("userId");

    if (!telegramUserIdStr && !userId) {
      return NextResponse.json(
        { success: false, error: "telegramUserId or userId is required" },
        { status: 400 }
      );
    }

    let user: any = null;

    if (userId) {
      user = await prisma.user.findUnique({
        where: { id: userId },
      });
    } else if (telegramUserIdStr) {
      user = await prisma.user.findUnique({
        where: { telegramUserId: BigInt(telegramUserIdStr) },
      });
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Enforce lazy expiration check
    const vipStatus = await getUserVipStatus(user.id);

    // Fetch user's full purchase history
    const purchases = await prisma.paymentTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        vipPackage: true,
        package: true,
        vipSubscription: true,
      },
    });

    const now = new Date();
    let remainingDays = 0;
    let remainingHours = 0;

    if (vipStatus.isVip && vipStatus.vipExpiresAt) {
      const diffMs = new Date(vipStatus.vipExpiresAt).getTime() - now.getTime();
      if (diffMs > 0) {
        remainingDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        remainingHours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      }
    }

    const serializedPurchases = purchases.map((p) => ({
      id: p.id,
      orderType: p.orderType,
      packageName:
        p.vipPackage?.name ||
        p.package?.name ||
        (p.orderType === "VIP_SUBSCRIPTION" ? "VIP Membership" : "Points Top-up"),
      amountPaid: p.amountPaid,
      starsAmount: p.starsAmount,
      pointsAmount: p.pointsAmount,
      currency: p.currency,
      provider: p.provider,
      status: p.status,
      telegramPaymentChargeId: p.telegramPaymentChargeId,
      orderPayload: p.orderPayload,
      description: p.description,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      vipStart: p.vipSubscription?.startedAt?.toISOString() || null,
      vipExpiration: p.vipSubscription?.expiresAt?.toISOString() || null,
      subscriptionStatus: p.vipSubscription?.status || null,
    }));

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        telegramUserId: user.telegramUserId.toString(),
        firstName: user.firstName,
        username: user.username,
        pointsBalance: vipStatus.pointsBalance,
        isVip: vipStatus.isVip,
        activeVipPlan: vipStatus.activeVipPlan,
        vipExpiresAt: vipStatus.vipExpiresAt?.toISOString() || null,
        remainingDays,
        remainingHours,
        isProfileComplete: user.isProfileComplete,
      },
      purchases: serializedPurchases,
    });
  } catch (error: any) {
    console.error("User purchases API error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
