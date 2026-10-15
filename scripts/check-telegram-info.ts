import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const token = process.env.TELEGRAM_BOT_TOKEN;

async function checkTelegram() {
  if (!token) {
    console.error("No TELEGRAM_BOT_TOKEN found");
    return;
  }

  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const meData = await meRes.json();
  console.log("Bot getMe:", JSON.stringify(meData, null, 2));

  const updatesRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=50`);
  const updatesData = await updatesRes.json();
  console.log("Updates count:", updatesData.result?.length ?? 0);
  if (updatesData.ok && updatesData.result) {
    for (const u of updatesData.result) {
      const msg = u.message || u.my_chat_member || u.channel_post || u.chat_member;
      if (msg && msg.chat) {
        console.log("Chat in update:", { id: msg.chat.id, type: msg.chat.type, title: msg.chat.title || msg.chat.username });
      }
    }
  }
}

checkTelegram().catch(console.error);
