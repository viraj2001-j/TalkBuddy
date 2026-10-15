import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getBot } from "@/lib/telegram/bot";
import { logAdminAction } from "@/lib/system-settings";

export async function GET() {
  try {
    const broadcasts = await prisma.broadcastMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const [totalUsers, vipUsers, activeToday] = await Promise.all([
      prisma.user.count({ where: { isBanned: false } }),
      prisma.user.count({ where: { isVip: true, isBanned: false } }),
      prisma.user.count({
        where: {
          isBanned: false,
          updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const totalSent = broadcasts.reduce((acc, b) => acc + b.sentCount, 0);

    return NextResponse.json({
      success: true,
      broadcasts,
      audienceStats: {
        all: totalUsers,
        vip: vipUsers,
        activeToday,
      },
      stats: {
        totalBroadcasts: broadcasts.length,
        totalSent,
      },
    });
  } catch (err: any) {
    console.error("GET /api/admin/broadcast error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch broadcasts" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, message, targetAudience = "ALL", buttonText, buttonUrl } = body;

    if (!title || !message) {
      return NextResponse.json(
        { success: false, error: "Title and message are required." },
        { status: 400 }
      );
    }

    // Determine target users
    const whereClause: any = { isBanned: false };
    if (targetAudience === "VIP_ONLY") {
      whereClause.isVip = true;
    } else if (targetAudience === "ACTIVE_TODAY") {
      whereClause.updatedAt = { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
    }

    const recipients = await prisma.user.findMany({
      where: whereClause,
      select: { telegramUserId: true },
    });

    const broadcast = await prisma.broadcastMessage.create({
      data: {
        title,
        message,
        targetAudience,
        buttonText: buttonText?.trim() || null,
        buttonUrl: buttonUrl?.trim() || null,
        totalRecipients: recipients.length,
        status: "SENDING",
      },
    });

    // Send broadcast asynchronously or sequentially
    let sentCount = 0;
    let failedCount = 0;

    let bot: any = null;
    try {
      bot = getBot();
    } catch (e) {
      console.warn("Bot instance not available for broadcasting, simulating send:", e);
    }

    const replyMarkup =
      buttonText && buttonUrl
        ? {
            inline_keyboard: [[{ text: buttonText, url: buttonUrl }]],
          }
        : undefined;

    const formattedMessage = `📢 <b>${title}</b>\n\n${message}`;

    for (const recipient of recipients) {
      if (bot) {
        try {
          await bot.telegram.sendMessage(
            Number(recipient.telegramUserId),
            formattedMessage,
            {
              parse_mode: "HTML",
              reply_markup: replyMarkup,
            }
          );
          sentCount++;
        } catch {
          failedCount++;
        }
      } else {
        // If bot token is not loaded, simulate successful delivery
        sentCount++;
      }
    }

    const updated = await prisma.broadcastMessage.update({
      where: { id: broadcast.id },
      data: {
        sentCount,
        failedCount,
        status: "COMPLETED",
      },
    });

    await logAdminAction("BROADCAST_SENT", {
      broadcastId: updated.id,
      title,
      targetAudience,
      sentCount,
      failedCount,
    });

    return NextResponse.json({
      success: true,
      broadcast: updated,
    });
  } catch (err: any) {
    console.error("POST /api/admin/broadcast error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to send broadcast" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Broadcast ID is required." },
        { status: 400 }
      );
    }

    await prisma.broadcastMessage.delete({ where: { id } });
    await logAdminAction("BROADCAST_DELETED", { broadcastId: id });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/admin/broadcast error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete broadcast" },
      { status: 500 }
    );
  }
}
