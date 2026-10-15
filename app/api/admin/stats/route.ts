import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const totalUsers = await prisma.user.count();
    const vipUsers = await prisma.user.count({
      where: { isVip: true },
    });
    const queueCount = await prisma.matchingQueue.count({
      where: { status: "WAITING" },
    });
    const activeSessions = await prisma.chatSession.count({
      where: { status: "ACTIVE" },
    });
    const totalMessages = await prisma.chatMessage.count();
    const mediaCount = await prisma.userMedia.count();

    const pointsAggregation = await prisma.user.aggregate({
      _sum: {
        pointsBalance: true,
      },
    });

    const paymentStats = await prisma.paymentTransaction.aggregate({
      where: { status: "COMPLETED" },
      _sum: {
        amountPaid: true,
        pointsAmount: true,
      },
      _count: {
        id: true,
      },
    });

    const totalPackages = await prisma.pointsPackage.count({
      where: { isActive: true },
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        vipUsers,
        queueCount,
        activeSessions,
        totalMessages,
        mediaCount,
        totalPointsBalance: pointsAggregation._sum.pointsBalance || 0,
        totalRevenueUsd: paymentStats._sum.amountPaid || 0,
        totalPaymentsCount: paymentStats._count.id || 0,
        totalPointsSold: paymentStats._sum.pointsAmount || 0,
        totalPackages,
      },
    });
  } catch (error: any) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
