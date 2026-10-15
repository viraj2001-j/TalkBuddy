import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const gender = searchParams.get("gender");
    const verified = searchParams.get("verified");
    const country = searchParams.get("country");

    const where: any = { isVip: true };

    if (gender && gender !== "ALL") {
      where.gender = gender;
    }
    if (verified === "true") {
      where.isProfileComplete = true;
    } else if (verified === "false") {
      where.isProfileComplete = false;
    }
    if (country && country !== "ALL") {
      where.country = { contains: country, mode: "insensitive" };
    }

    const vipUsers = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        telegramUserId: true,
        firstName: true,
        lastName: true,
        username: true,
        gender: true,
        age: true,
        country: true,
        isProfileComplete: true,
        isVerified: true,
        genderFilterPreference: true,
        activeVipPlan: true,
        vipExpiresAt: true,
        pointsBalance: true,
        createdAt: true,
      },
    });

    const recentTransactions = await prisma.pointsTransaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            telegramUserId: true,
            firstName: true,
            username: true,
          },
        },
      },
    });

    const serializedVipUsers = vipUsers.map((u) => ({
      ...u,
      telegramUserId: u.telegramUserId.toString(),
    }));

    const serializedTransactions = recentTransactions.map((t) => ({
      ...t,
      user: {
        ...t.user,
        telegramUserId: t.user.telegramUserId.toString(),
      },
    }));

    return NextResponse.json({
      success: true,
      vipUsers: serializedVipUsers,
      transactions: serializedTransactions,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Grant VIP to user
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, planLabel, durationDays } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    const days = Number(durationDays) || 30;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: {
          isVip: true,
          vipExpiresAt: expiresAt,
          activeVipPlan: planLabel || `${days} Days Pass`,
        },
      });

      // Record in VipSubscription table
      await tx.vipSubscription.create({
        data: {
          userId,
          planKey: "admin_grant",
          planLabel: planLabel || `${days} Days Pass`,
          paymentMethod: "ADMIN_GRANT",
          costAmount: 0,
          currency: "USD",
          status: "ACTIVE",
          startedAt: now,
          expiresAt,
        },
      });

      // Record in points transaction ledger as admin grant
      await tx.pointsTransaction.create({
        data: {
          userId,
          amount: 0,
          type: "ADMIN_ADJUSTMENT",
          description: `Admin granted VIP access (${planLabel || `${days} Days`})`,
        },
      });

      return u;
    });

    return NextResponse.json({
      success: true,
      user: {
        ...updated,
        telegramUserId: updated.telegramUserId.toString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Revoke VIP
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: {
          isVip: false,
          vipExpiresAt: null,
          activeVipPlan: null,
        },
      });

      await tx.vipSubscription.updateMany({
        where: {
          userId,
          status: "ACTIVE",
        },
        data: { status: "CANCELLED" },
      });

      return u;
    });

    return NextResponse.json({
      success: true,
      message: "VIP access revoked",
      user: {
        ...updated,
        telegramUserId: updated.telegramUserId.toString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
