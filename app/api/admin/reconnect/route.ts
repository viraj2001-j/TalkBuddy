import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logAdminAction } from "@/lib/system-settings";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const where: any = {};
    if (status && status !== "ALL") {
      where.status = status;
    }

    const requests = await prisma.reconnectRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        sender: {
          select: {
            id: true,
            telegramUserId: true,
            username: true,
            firstName: true,
          },
        },
        receiver: {
          select: {
            id: true,
            telegramUserId: true,
            username: true,
            firstName: true,
          },
        },
      },
      take: 100,
    });

    const [pendingCount, acceptedCount, declinedCount, cancelledCount] =
      await Promise.all([
        prisma.reconnectRequest.count({ where: { status: "PENDING" } }),
        prisma.reconnectRequest.count({ where: { status: "ACCEPTED" } }),
        prisma.reconnectRequest.count({ where: { status: "DECLINED" } }),
        prisma.reconnectRequest.count({ where: { status: "CANCELLED" } }),
      ]);

    const serialized = requests.map((r) => ({
      ...r,
      sender: {
        ...r.sender,
        telegramUserId: r.sender.telegramUserId.toString(),
      },
      receiver: {
        ...r.receiver,
        telegramUserId: r.receiver.telegramUserId.toString(),
      },
    }));

    return NextResponse.json({
      success: true,
      requests: serialized,
      stats: {
        total: requests.length,
        pending: pendingCount,
        accepted: acceptedCount,
        declined: declinedCount,
        cancelled: cancelledCount,
      },
    });
  } catch (err: any) {
    console.error("GET /api/admin/reconnect error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch reconnect requests" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { requestId, status } = body;

    if (!requestId || !status) {
      return NextResponse.json(
        { success: false, error: "Request ID and status are required." },
        { status: 400 }
      );
    }

    const updated = await prisma.reconnectRequest.update({
      where: { id: requestId },
      data: { status },
    });

    await logAdminAction("RECONNECT_STATUS_UPDATED", {
      requestId,
      newStatus: status,
    });

    return NextResponse.json({ success: true, request: updated });
  } catch (err: any) {
    console.error("PATCH /api/admin/reconnect error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update reconnect request" },
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
        { success: false, error: "Request ID is required." },
        { status: 400 }
      );
    }

    await prisma.reconnectRequest.delete({ where: { id } });
    await logAdminAction("RECONNECT_DELETED", { requestId: id });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/admin/reconnect error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete reconnect request" },
      { status: 500 }
    );
  }
}
