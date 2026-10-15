import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const queueEntries = await prisma.matchingQueue.findMany({
      where: {
        status: "WAITING",
      },
      orderBy: { joinedAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            telegramUserId: true,
            firstName: true,
            lastName: true,
            username: true,
            gender: true,
            isVip: true,
            activeVipPlan: true,
            pointsBalance: true,
          },
        },
      },
    });

    const serialized = queueEntries.map((item) => ({
      ...item,
      user: {
        ...item.user,
        telegramUserId: item.user.telegramUserId.toString(),
      },
    }));

    return NextResponse.json({
      success: true,
      queue: serialized,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Force match two users from the queue
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userOneId, userTwoId } = body;

    if (!userOneId || !userTwoId || userOneId === userTwoId) {
      return NextResponse.json(
        { success: false, error: "Two distinct user IDs are required" },
        { status: 400 }
      );
    }

    const session = await prisma.$transaction(async (tx) => {
      // Connect user one
      await tx.matchingQueue.upsert({
        where: { userId: userOneId },
        update: { status: "MATCHED", partnerUserId: userTwoId },
        create: { userId: userOneId, status: "MATCHED", partnerUserId: userTwoId },
      });

      // Connect user two
      await tx.matchingQueue.upsert({
        where: { userId: userTwoId },
        update: { status: "MATCHED", partnerUserId: userOneId },
        create: { userId: userTwoId, status: "MATCHED", partnerUserId: userOneId },
      });

      // Create ChatSession
      return await tx.chatSession.create({
        data: {
          userOneId,
          userTwoId,
          status: "ACTIVE",
        },
      });
    });

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Remove / Kick user from queue
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

    await prisma.matchingQueue.updateMany({
      where: { userId, status: "WAITING" },
      data: { status: "CANCELLED", partnerUserId: null },
    });

    return NextResponse.json({
      success: true,
      message: "User removed from waiting queue",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
