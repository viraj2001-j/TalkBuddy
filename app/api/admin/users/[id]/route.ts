import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        pointsTransactions: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        media: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        matchingQueue: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        telegramUserId: user.telegramUserId.toString(),
        media: user.media.map((m) => ({
          ...m,
          fileSize: m.fileSize ? m.fileSize.toString() : null,
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
