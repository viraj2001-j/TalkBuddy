import { NextRequest, NextResponse } from "next/server";
import { getBot } from "@/lib/telegram/bot";

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    const bot = getBot();

    await bot.handleUpdate(update);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Webhook processing failed",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "TalkBuddy Telegram webhook endpoint is active",
  });
}
