import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logAdminAction } from "@/lib/system-settings";

const ALLOWED_TABLES = [
  "User",
  "UserSetting",
  "MatchingQueue",
  "ChatSession",
  "ChatMessage",
  "UserMedia",
  "PreviousPartner",
  "ReconnectRequest",
  "PointsPackage",
  "PaymentTransaction",
  "PointsTransaction",
  "UserReport",
  "BroadcastMessage",
  "SystemSetting",
  "AdminAuditLog",
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const selectedTable = searchParams.get("table");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const startTime = Date.now();
    // Quick ping to check DB latency
    await prisma.$queryRaw`SELECT 1;`;
    const latencyMs = Date.now() - startTime;

    // Get table counts and database size
    const tableCounts: Record<string, number> = {};
    for (const t of ALLOWED_TABLES) {
      try {
        const res: any[] = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::int as count FROM "${t}";`
        );
        tableCounts[t] = res[0]?.count ?? 0;
      } catch {
        tableCounts[t] = 0;
      }
    }

    // Database size query in PostgreSQL
    let dbSize = "N/A";
    try {
      const sizeRes: any[] = await prisma.$queryRaw`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size;
      `;
      dbSize = sizeRes[0]?.size || "N/A";
    } catch (e) {
      console.warn("Could not fetch DB size:", e);
    }

    // If specific table requested, fetch rows
    let tableRows: any[] = [];
    let totalRows = 0;

    if (selectedTable && ALLOWED_TABLES.includes(selectedTable)) {
      const skip = (page - 1) * limit;
      totalRows = tableCounts[selectedTable] || 0;

      const rawRows: any[] = await prisma.$queryRawUnsafe(
        `SELECT * FROM "${selectedTable}" ORDER BY 1 DESC LIMIT ${limit} OFFSET ${skip};`
      );

      // Serialize BigInt values to string for JSON output
      tableRows = rawRows.map((row) => {
        const serialized: any = {};
        for (const [k, v] of Object.entries(row)) {
          if (typeof v === "bigint") {
            serialized[k] = v.toString();
          } else {
            serialized[k] = v;
          }
        }
        return serialized;
      });
    }

    return NextResponse.json({
      success: true,
      telemetry: {
        status: "CONNECTED",
        database: "talkbuddy",
        provider: "PostgreSQL",
        latencyMs,
        dbSize,
        totalTables: ALLOWED_TABLES.length,
      },
      tableCounts,
      tableData: selectedTable
        ? {
            table: selectedTable,
            rows: tableRows,
            total: totalRows,
            page,
            limit,
          }
        : null,
    });
  } catch (err: any) {
    console.error("GET /api/admin/database error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to inspect database" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, table, rowId } = body;

    if (action === "CLEAN_STALE_QUEUES") {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const cleaned = await prisma.matchingQueue.deleteMany({
        where: {
          updatedAt: { lte: cutoff },
          status: { in: ["ENDED", "WAITING"] },
        },
      });

      await logAdminAction("DB_CLEAN_STALE_QUEUES", { count: cleaned.count });
      return NextResponse.json({
        success: true,
        message: `Cleaned ${cleaned.count} stale queue records.`,
      });
    }

    if (action === "PURGE_OLD_ENDED_CHATS") {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const purged = await prisma.chatSession.deleteMany({
        where: {
          status: "ENDED",
          endedAt: { lte: cutoff },
        },
      });

      await logAdminAction("DB_PURGE_OLD_CHATS", { count: purged.count });
      return NextResponse.json({
        success: true,
        message: `Purged ${purged.count} old chat sessions.`,
      });
    }

    if (action === "OPTIMIZE_DATABASE") {
      // Run ANALYZE on public schema
      await prisma.$executeRawUnsafe("ANALYZE;");
      await logAdminAction("DB_OPTIMIZE_ANALYZE", "Executed ANALYZE on PostgreSQL schema");
      return NextResponse.json({
        success: true,
        message: "PostgreSQL ANALYZE completed successfully.",
      });
    }

    if (action === "DELETE_ROW") {
      if (!table || !rowId || !ALLOWED_TABLES.includes(table)) {
        return NextResponse.json(
          { success: false, error: "Invalid table or row ID." },
          { status: 400 }
        );
      }

      await prisma.$executeRawUnsafe(
        `DELETE FROM "${table}" WHERE id = '${rowId}';`
      );

      await logAdminAction("DB_DELETE_ROW", { table, rowId });
      return NextResponse.json({
        success: true,
        message: `Deleted row ${rowId} from ${table}.`,
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action." },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("POST /api/admin/database error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to execute database operation" },
      { status: 500 }
    );
  }
}
