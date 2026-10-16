import { NextRequest, NextResponse } from "next/server";
import { getBot } from "@/lib/telegram/bot";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    // Optional: Validate Telegram webhook secret token if configured
    const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (configuredSecret) {
      const headerSecret = req.headers.get("x-telegram-bot-api-secret-token");
      if (headerSecret !== configuredSecret) {
        console.warn("Unauthorized webhook request rejected: secret token mismatch");
        return NextResponse.json(
          { ok: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    const update = await req.json();
    const bot = getBot();

    await bot.handleUpdate(update);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);

    // Return 200 with ok: false so Telegram doesn't endlessly retry corrupted updates on serverless
    return NextResponse.json(
      {
        ok: false,
        error: "Webhook processing encountered an error",
      },
      { status: 200 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "TalkBuddy Telegram Webhook",
    timestamp: new Date().toISOString(),
    configured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
  });
}
