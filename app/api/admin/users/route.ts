import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";
    const vipFilter = searchParams.get("vip");
    const roleFilter = searchParams.get("role");
    const bannedFilter = searchParams.get("banned");
    const genderFilter = searchParams.get("gender");
    const verifiedFilter = searchParams.get("verified");
    const countryFilter = searchParams.get("country");

    const where: any = {};

    if (query) {
      where.OR = [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { username: { contains: query, mode: "insensitive" } },
      ];

      if (!isNaN(Number(query))) {
        where.OR.push({ telegramUserId: BigInt(query) });
      }
    }

    if (genderFilter && genderFilter !== "ALL") {
      where.gender = genderFilter;
    }

    if (verifiedFilter === "true") {
      where.isProfileComplete = true;
    } else if (verifiedFilter === "false") {
      where.isProfileComplete = false;
    }

    if (countryFilter && countryFilter !== "ALL") {
      where.country = { contains: countryFilter, mode: "insensitive" };
    }

    if (vipFilter === "true") {
      where.isVip = true;
    } else if (vipFilter === "false") {
      where.isVip = false;
    }

    if (roleFilter) {
      where.role = roleFilter;
    }

    if (bannedFilter === "true") {
      where.isBanned = true;
    } else if (bannedFilter === "false") {
      where.isBanned = false;
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        telegramUserId: true,
        username: true,
        firstName: true,
        lastName: true,
        gender: true,
        age: true,
        country: true,
        isProfileComplete: true,
        isVerified: true,
        verifiedAt: true,
        genderFilterPreference: true,
        role: true,
        pointsBalance: true,
        isVip: true,
        vipExpiresAt: true,
        activeVipPlan: true,
        isBanned: true,
        banReason: true,
        referralCode: true,
        lastDailyRewardAt: true,
        createdAt: true,
        _count: {
          select: {
            sentMessages: true,
            chatSessionsAsUserOne: true,
            chatSessionsAsUserTwo: true,
            paymentTransactions: true,
            referredUsers: true,
          },
        },
      },
    });

    const serializedUsers = users.map((u) => ({
      ...u,
      telegramUserId: u.telegramUserId.toString(),
      totalSessions:
        u._count.chatSessionsAsUserOne + u._count.chatSessionsAsUserTwo,
      totalMessagesSent: u._count.sentMessages,
      totalPayments: u._count.paymentTransactions,
      referralCount: u._count.referredUsers,
    }));

    return NextResponse.json({
      success: true,
      users: serializedUsers,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      telegramUserId,
      firstName,
      lastName,
      username,
      gender,
      role,
      pointsBalance,
      isVip,
      activeVipPlan,
    } = body;

    if (!telegramUserId || !firstName) {
      return NextResponse.json(
        { success: false, error: "telegramUserId and firstName are required" },
        { status: 400 }
      );
    }

    const newUser = await prisma.user.create({
      data: {
        telegramUserId: BigInt(telegramUserId),
        firstName,
        lastName: lastName || null,
        username: username || null,
        gender: gender || "Not Specified",
        role: role || "USER",
        pointsBalance: typeof pointsBalance === "number" ? pointsBalance : 100,
        isVip: !!isVip,
        activeVipPlan: activeVipPlan || null,
        referralCode: `ref_${Math.random().toString(36).substring(2, 8)}`,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        ...newUser,
        telegramUserId: newUser.telegramUserId.toString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      pointsBalance,
      pointsDelta,
      pointsReason,
      isVip,
      activeVipPlan,
      vipDays,
      role,
      isBanned,
      banReason,
      firstName,
      lastName,
      gender,
      age,
      country,
      isProfileComplete,
      isVerified,
      genderFilterPreference,
    } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (gender !== undefined) updateData.gender = gender;
    if (age !== undefined) updateData.age = typeof age === "number" ? age : parseInt(age, 10) || null;
    if (country !== undefined) updateData.country = country;
    if (isProfileComplete !== undefined) updateData.isProfileComplete = !!isProfileComplete;
    if (isVerified !== undefined) {
      updateData.isVerified = !!isVerified;
      if (isVerified) updateData.verifiedAt = new Date();
    }
    if (genderFilterPreference !== undefined) updateData.genderFilterPreference = genderFilterPreference;
    if (role !== undefined) updateData.role = role;
    if (isBanned !== undefined) updateData.isBanned = isBanned;
    if (banReason !== undefined) updateData.banReason = banReason;

    // Handle VIP grant/revoke
    if (typeof isVip === "boolean") {
      updateData.isVip = isVip;
      if (!isVip) {
        updateData.vipExpiresAt = null;
        updateData.activeVipPlan = null;
      } else if (vipDays) {
        const expires = new Date();
        expires.setDate(expires.getDate() + Number(vipDays));
        updateData.vipExpiresAt = expires;
        updateData.activeVipPlan = activeVipPlan || "CUSTOM_PASS";
      }
    }

    // Direct points overwrite
    if (typeof pointsBalance === "number") {
      updateData.pointsBalance = pointsBalance;
    }

    // Incremental points adjustment (e.g. Add 500 points from admin with audit trail)
    if (typeof pointsDelta === "number" && pointsDelta !== 0) {
      updateData.pointsBalance = {
        increment: pointsDelta,
      };

      await prisma.pointsTransaction.create({
        data: {
          userId,
          amount: pointsDelta,
          type: "ADMIN_ADJUSTMENT",
          description: pointsReason || "Manual adjustment by administrator",
        },
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      user: {
        ...updatedUser,
        telegramUserId: updatedUser.telegramUserId.toString(),
      },
    });
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
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
