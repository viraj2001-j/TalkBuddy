import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  ensureSystemSettingsInitialized,
  logAdminAction,
} from "@/lib/system-settings";

export async function GET() {
  try {
    await ensureSystemSettingsInitialized();

    const [settings, auditLogs] = await Promise.all([
      prisma.systemSetting.findMany({
        orderBy: { key: "asc" },
      }),
      prisma.adminAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    return NextResponse.json({
      success: true,
      settings,
      auditLogs,
    });
  } catch (err: any) {
    console.error("GET /api/admin/settings error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { settings } = body;

    if (!settings || !Array.isArray(settings)) {
      return NextResponse.json(
        { success: false, error: "Settings array is required." },
        { status: 400 }
      );
    }

    const updatedKeys: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const item of settings) {
        if (item.key && item.value !== undefined) {
          await tx.systemSetting.upsert({
            where: { key: item.key },
            update: { value: String(item.value) },
            create: {
              key: item.key,
              value: String(item.value),
              category: item.category || "GENERAL",
              description: item.description,
            },
          });
          updatedKeys.push(item.key);
        }
      }
    });

    await logAdminAction("SETTINGS_UPDATED", {
      updatedKeys,
      count: updatedKeys.length,
    });

    return NextResponse.json({
      success: true,
      updatedKeys,
    });
  } catch (err: any) {
    console.error("POST /api/admin/settings error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update settings" },
      { status: 500 }
    );
  }
}
