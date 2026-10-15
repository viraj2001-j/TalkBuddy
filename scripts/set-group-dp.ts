import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const token = process.env.TELEGRAM_BOT_TOKEN;

async function setGroupPhoto() {
  const chatId = process.argv[2];

  if (!token) {
    console.error("❌ Error: TELEGRAM_BOT_TOKEN is missing in environment files.");
    process.exit(1);
  }

  if (!chatId) {
    console.log(`
ℹ️  Telegram Group DP Setter Tool
=======================================
Usage:
  npx tsx scripts/set-group-dp.ts <CHAT_ID_OR_CHANNEL_USERNAME>

Example:
  npx tsx scripts/set-group-dp.ts -1001234567890
  npx tsx scripts/set-group-dp.ts @talkbuddy_community

Requirements:
  1. The bot (@${process.env.TELEGRAM_BOT_USERNAME || "TalkBuddyGlobalBot"}) must be added to the group.
  2. The bot must be promoted to Admin with 'Change Group Info' permission.
  3. You can also manually upload the image from: public/talkbuddy-group-dp.jpg
=======================================
`);
    return;
  }

  const imagePath = path.resolve(process.cwd(), "public", "talkbuddy-group-dp.jpg");
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Error: Image file not found at ${imagePath}`);
    process.exit(1);
  }

  console.log(`🚀 Uploading new Group DP to chat: ${chatId}...`);
  const imageBuffer = fs.readFileSync(imagePath);
  const blob = new Blob([imageBuffer], { type: "image/jpeg" });

  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("photo", blob, "group-dp.jpg");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setChatPhoto`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (data.ok) {
      console.log("✅ SUCCESS! Telegram Group DP has been updated successfully.");
    } else {
      console.error("❌ Telegram API returned an error:", data.description);
      console.log(`
Tips:
- Ensure the bot is an Administrator in the group.
- Ensure the bot has 'Change Group Info' permission enabled.
- Supergroup IDs typically begin with -100 (e.g. -100xxxxxxxxxx).
      `);
    }
  } catch (err: any) {
    console.error("❌ Failed to set chat photo:", err.message);
  }
}

setGroupPhoto().catch(console.error);
