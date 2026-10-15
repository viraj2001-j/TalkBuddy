import prisma from "../lib/db";
import { getSystemSetting, getSystemIntSetting, logAdminAction } from "../lib/system-settings";

async function testNewFeatures() {
  const BASE_URL = "http://localhost:3001";
  console.log("=================================================");
  console.log("   TESTING NEW TALKBUDDY FEATURES & DASHBOARD    ");
  console.log("=================================================\n");

  const testSuffix = Math.random().toString(36).substring(2, 7);

  // 1. Create test users
  const reporter = await prisma.user.create({
    data: {
      telegramUserId: BigInt(8800000000 + Math.floor(Math.random() * 9000000)),
      username: `rep_${testSuffix}`,
      firstName: `Reporter_${testSuffix}`,
      gender: "FEMALE",
      pointsBalance: 100,
    },
  });

  const offender = await prisma.user.create({
    data: {
      telegramUserId: BigInt(8810000000 + Math.floor(Math.random() * 9000000)),
      username: `off_${testSuffix}`,
      firstName: `Offender_${testSuffix}`,
      gender: "MALE",
      pointsBalance: 50,
    },
  });

  const session = await prisma.chatSession.create({
    data: {
      userOneId: reporter.id,
      userTwoId: offender.id,
      status: "ACTIVE",
    },
  });

  try {
    // TEST 1: System Settings API
    console.log("🔹 [TEST 1] Testing /api/admin/settings...");
    const settingsGetRes = await fetch(`${BASE_URL}/api/admin/settings`);
    const settingsGetData = await settingsGetRes.json();
    console.log(`✅ Loaded ${settingsGetData.settings?.length} settings`);

    // Update settings via API
    const settingsPostRes = await fetch(`${BASE_URL}/api/admin/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: [
          { key: "DAILY_REWARD_POINTS", value: "30" },
          { key: "GLOBAL_ANNOUNCEMENT", value: "Special Test Announcement" },
        ],
      }),
    });
    const settingsPostData = await settingsPostRes.json();
    if (!settingsPostData.success) throw new Error("Failed to update settings");

    const dynamicVal = await getSystemIntSetting("DAILY_REWARD_POINTS");
    if (dynamicVal !== 30) throw new Error(`Expected 30, got ${dynamicVal}`);
    console.log(`✅ Dynamic setting update verified: DAILY_REWARD_POINTS = ${dynamicVal}`);

    // Revert back
    await fetch(`${BASE_URL}/api/admin/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: [{ key: "DAILY_REWARD_POINTS", value: "25" }],
      }),
    });

    // TEST 2: Abuse Reports & Moderation API
    console.log("\n🔹 [TEST 2] Testing /api/admin/reports...");
    // Create report directly in DB (as bot would)
    const report = await prisma.userReport.create({
      data: {
        reporterId: reporter.id,
        reportedUserId: offender.id,
        chatSessionId: session.id,
        reason: "Harassment or Offensive Speech",
        details: "Sent offensive text in chat session",
        status: "PENDING",
      },
    });

    // Fetch reports via API
    const reportsGetRes = await fetch(`${BASE_URL}/api/admin/reports?status=PENDING`);
    const reportsGetData = await reportsGetRes.json();
    const foundReport = reportsGetData.reports?.find((r: any) => r.id === report.id);
    if (!foundReport) throw new Error("Created report not returned by API");
    console.log(`✅ Report retrieved via API: ${foundReport.reason}`);

    // Test Moderation Action: BAN_USER
    const banRes = await fetch(`${BASE_URL}/api/admin/reports`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportId: report.id,
        action: "BAN_USER",
        banReason: "Harassment in chat",
      }),
    });
    const banData = await banRes.json();
    if (!banData.success) throw new Error("Failed to ban user via report action");

    // Verify offender is banned in DB and session is ended
    const updatedOffender = await prisma.user.findUnique({ where: { id: offender.id } });
    const updatedSession = await prisma.chatSession.findUnique({ where: { id: session.id } });
    const updatedReport = await prisma.userReport.findUnique({ where: { id: report.id } });

    if (!updatedOffender?.isBanned) throw new Error("Offender is not banned in DB");
    if (updatedSession?.status !== "ENDED") throw new Error("Session was not ended upon ban");
    if (updatedReport?.status !== "RESOLVED_BANNED") throw new Error("Report not marked RESOLVED_BANNED");
    console.log(`✅ Moderation Action Verified: Offender banned, session ended, report resolved!`);

    // TEST 3: Push Broadcast API
    console.log("\n🔹 [TEST 3] Testing /api/admin/broadcast...");
    const broadcastPostRes = await fetch(`${BASE_URL}/api/admin/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Test Promo ${testSuffix}`,
        message: "Hello TalkBuddy users! This is a test broadcast.",
        targetAudience: "ALL",
        buttonText: "Join Event",
        buttonUrl: "https://t.me/talkbuddybot",
      }),
    });
    const broadcastPostData = await broadcastPostRes.json();
    if (!broadcastPostData.success) throw new Error("Broadcast creation failed");
    console.log(`✅ Broadcast sent: Delivered to ${broadcastPostData.broadcast?.sentCount} recipients`);

    const broadcastGetRes = await fetch(`${BASE_URL}/api/admin/broadcast`);
    const broadcastGetData = await broadcastGetRes.json();
    const foundBroadcast = broadcastGetData.broadcasts?.find((b: any) => b.id === broadcastPostData.broadcast?.id);
    if (!foundBroadcast) throw new Error("Broadcast not found in list");
    console.log(`✅ Broadcast retrieved in history table: ${foundBroadcast.title}`);

    // Cleanup broadcast
    await fetch(`${BASE_URL}/api/admin/broadcast?id=${broadcastPostData.broadcast?.id}`, {
      method: "DELETE",
    });
    console.log(`✅ Broadcast record cleaned up`);

    // TEST 4: Frontend Routes Verification (all 11 routes now!)
    console.log("\n🔹 [TEST 4] Testing All 11 Frontend Routes...");
    const allRoutes = [
      "/",
      "/admin",
      "/admin/payments",
      "/admin/users",
      "/admin/chats",
      "/admin/queue",
      "/admin/vip",
      "/admin/media",
      "/admin/broadcast",
      "/admin/reports",
      "/admin/settings",
    ];

    for (const path of allRoutes) {
      const res = await fetch(`${BASE_URL}${path}`);
      if (res.status !== 200) throw new Error(`Route ${path} failed with status ${res.status}`);
      console.log(`✅ [200 OK] ${path}`);
    }

    console.log("\n=================================================");
    console.log("🎉 ALL NEW FEATURES TESTED & OPERATIONAL 100%!");
    console.log("=================================================");
  } finally {
    // Cleanup test users and records
    await prisma.userReport.deleteMany({
      where: { reporterId: reporter.id },
    });
    await prisma.chatSession.deleteMany({
      where: { id: session.id },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [reporter.id, offender.id] } },
    });
    console.log("Cleaned up test data.");
  }
}

testNewFeatures().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
