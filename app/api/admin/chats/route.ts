import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const status = searchParams.get("status");

    if (sessionId) {
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: {
          userOne: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              telegramUserId: true,
            },
          },
          userTwo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              telegramUserId: true,
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              sender: {
                select: {
                  id: true,
                  firstName: true,
                  username: true,
                },
              },
            },
          },
        },
      });

      if (!session) {
        return NextResponse.json(
          { success: false, error: "Session not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        session: {
          ...session,
          userOne: {
            ...session.userOne,
            telegramUserId: session.userOne.telegramUserId.toString(),
          },
          userTwo: {
            ...session.userTwo,
            telegramUserId: session.userTwo.telegramUserId.toString(),
          },
        },
      });
    }

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const sessions = await prisma.chatSession.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: 100,
      include: {
        userOne: {
          select: {
            id: true,
            firstName: true,
            username: true,
            telegramUserId: true,
          },
        },
        userTwo: {
          select: {
            id: true,
            firstName: true,
            username: true,
            telegramUserId: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    const serialized = sessions.map((s) => ({
      ...s,
      userOne: {
        ...s.userOne,
        telegramUserId: s.userOne.telegramUserId.toString(),
      },
      userTwo: {
        ...s.userTwo,
        telegramUserId: s.userTwo.telegramUserId.toString(),
      },
    }));

    return NextResponse.json({
      success: true,
      sessions: serialized,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Force end a chat session from Admin
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, endReason } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "sessionId is required" },
        { status: 400 }
      );
    }

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    // End session
    const updated = await prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        status: "ENDED",
        endedAt: new Date(),
        endReason: endReason || "ADMIN_TERMINATED",
      },
    });

    // Also update queues for both users if still linked
    await prisma.matchingQueue.updateMany({
      where: {
        userId: { in: [session.userOneId, session.userTwoId] },
        status: "MATCHED",
      },
      data: {
        status: "ENDED",
        partnerUserId: null,
      },
    });

    return NextResponse.json({
      success: true,
      session: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Delete chat session and its transcripts
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "sessionId is required" },
        { status: 400 }
      );
    }

    await prisma.chatSession.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({
      success: true,
      message: "Chat session and messages deleted successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
