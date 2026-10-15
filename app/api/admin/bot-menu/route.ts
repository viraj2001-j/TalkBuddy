import { NextResponse } from "next/server";
import { getBot } from "@/lib/telegram/bot";
import { setupBotMenu } from "@/lib/telegram/menu";

export async function GET() {
  try {
    const bot = getBot();
    const commands = await bot.telegram.getMyCommands();
    return NextResponse.json({
      success: true,
      count: commands.length,
      commands,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const bot = getBot();
    await setupBotMenu(bot);
    const commands = await bot.telegram.getMyCommands();
    return NextResponse.json({
      success: true,
      message: "Commands successfully synchronized with Telegram Bot API",
      count: commands.length,
      commands,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
