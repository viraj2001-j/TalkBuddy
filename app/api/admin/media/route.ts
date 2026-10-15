import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    const where: any = {};
    if (type) where.type = type;

    const media = await prisma.userMedia.findMany({
      where,
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

    const serialized = media.map((m) => ({
      ...m,
      fileSize: m.fileSize ? m.fileSize.toString() : null,
      user: {
        ...m.user,
        telegramUserId: m.user.telegramUserId.toString(),
      },
    }));

    return NextResponse.json({
      success: true,
      media: serialized,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Delete media record
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mediaId = searchParams.get("mediaId");

    if (!mediaId) {
      return NextResponse.json(
        { success: false, error: "mediaId is required" },
        { status: 400 }
      );
    }

    await prisma.userMedia.delete({
      where: { id: mediaId },
    });

    return NextResponse.json({
      success: true,
      message: "Media record deleted successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
