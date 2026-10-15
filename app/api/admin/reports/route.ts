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

    const reports = await prisma.userReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        reporter: {
          select: {
            id: true,
            telegramUserId: true,
            username: true,
            firstName: true,
          },
        },
        reportedUser: {
          select: {
            id: true,
            telegramUserId: true,
            username: true,
            firstName: true,
            isBanned: true,
            banReason: true,
            pointsBalance: true,
          },
        },
        chatSession: {
          select: {
            id: true,
            status: true,
            startedAt: true,
          },
        },
      },
    });

    const [pendingCount, bannedCount, dismissedCount] = await Promise.all([
      prisma.userReport.count({ where: { status: "PENDING" } }),
      prisma.userReport.count({ where: { status: "RESOLVED_BANNED" } }),
      prisma.userReport.count({ where: { status: "DISMISSED" } }),
    ]);

    const serializedReports = reports.map((r) => ({
      ...r,
      reporter: {
        ...r.reporter,
        telegramUserId: r.reporter.telegramUserId.toString(),
      },
      reportedUser: {
        ...r.reportedUser,
        telegramUserId: r.reportedUser.telegramUserId.toString(),
      },
    }));

    return NextResponse.json({
      success: true,
      reports: serializedReports,
      stats: {
        total: reports.length,
        pending: pendingCount,
        banned: bannedCount,
        dismissed: dismissedCount,
      },
    });
  } catch (err: any) {
    console.error("GET /api/admin/reports error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch user reports" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { reportId, action, banReason, adminNotes } = body;

    if (!reportId || !action) {
      return NextResponse.json(
        { success: false, error: "Report ID and action are required." },
        { status: 400 }
      );
    }

    const report = await prisma.userReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return NextResponse.json(
        { success: false, error: "Report not found." },
        { status: 404 }
      );
    }

    if (action === "BAN_USER") {
      const reason = banReason || report.reason || "Reported for abusive behavior";

      // Ban user and end their active queue & chat sessions
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: report.reportedUserId },
          data: {
            isBanned: true,
            banReason: reason,
          },
        });

        await tx.matchingQueue.updateMany({
          where: { userId: report.reportedUserId },
          data: { status: "ENDED", partnerUserId: null },
        });

        await tx.chatSession.updateMany({
          where: {
            OR: [
              { userOneId: report.reportedUserId },
              { userTwoId: report.reportedUserId },
            ],
            status: "ACTIVE",
          },
          data: {
            status: "ENDED",
            endedAt: new Date(),
            endReason: "MODERATOR_BANNED",
          },
        });

        await tx.userReport.update({
          where: { id: reportId },
          data: {
            status: "RESOLVED_BANNED",
            adminNotes: adminNotes || `Banned with reason: ${reason}`,
          },
        });
      });

      await logAdminAction("REPORT_RESOLVED_BANNED", {
        reportId,
        reportedUserId: report.reportedUserId,
        banReason: reason,
      });

      return NextResponse.json({ success: true, message: "User banned and report resolved." });
    }

    if (action === "DISMISS") {
      await prisma.userReport.update({
        where: { id: reportId },
        data: {
          status: "DISMISSED",
          adminNotes: adminNotes || "Dismissed by administrator",
        },
      });

      await logAdminAction("REPORT_DISMISSED", { reportId });

      return NextResponse.json({ success: true, message: "Report dismissed." });
    }

    if (action === "UPDATE_NOTES") {
      await prisma.userReport.update({
        where: { id: reportId },
        data: { adminNotes },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action." },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("PATCH /api/admin/reports error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update report" },
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
        { success: false, error: "Report ID is required." },
        { status: 400 }
      );
    }

    await prisma.userReport.delete({ where: { id } });
    await logAdminAction("REPORT_DELETED", { reportId: id });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/admin/reports error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to delete report" },
      { status: 500 }
    );
  }
}
