import prisma from "../lib/db";
import {
  claimDailyReward,
  processReferral,
  spendPoints,
  addPoints,
  rewardChatCompletion,
  processPackagePayment,
} from "../lib/telegram/points";
import { checkUserBan } from "../lib/telegram/security";
import { findAndCreateMatch } from "../lib/telegram/matching";
import { getSystemSetting, getSystemIntSetting, logAdminAction } from "../lib/system-settings";
import { savePreviousPartner, getPreviousPartner, getPreviousPartnerId } from "../lib/telegram/previous-partners";

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

async function runMasterTest() {
  console.log("=================================================================");
  console.log("       TALKBUDDY MASTER SYSTEM-WIDE E2E VERIFICATION SUITE       ");
  console.log("=================================================================\n");

  let totalTests = 0;
  let passedTests = 0;
  const errors: string[] = [];

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   Details: ${detail}`);
      errors.push(`${testName}: ${detail || "Condition false"}`);
    }
  }

  const testSuffix = Math.random().toString(36).substring(2, 7);

  // Setup test users
  const user1 = await prisma.user.create({
    data: {
      telegramUserId: BigInt(7700000000 + Math.floor(Math.random() * 9000000)),
      username: `m_user1_${testSuffix}`,
      firstName: `MasterUser1_${testSuffix}`,
      gender: "MALE",
      pointsBalance: 150,
      referralCode: `REF_M1_${testSuffix}`,
    },
  });

  const user2 = await prisma.user.create({
    data: {
      telegramUserId: BigInt(7710000000 + Math.floor(Math.random() * 9000000)),
      username: `m_user2_${testSuffix}`,
      firstName: `MasterUser2_${testSuffix}`,
      gender: "FEMALE",
      pointsBalance: 100,
      referralCode: `REF_M2_${testSuffix}`,
    },
  });

  const user3 = await prisma.user.create({
    data: {
      telegramUserId: BigInt(7720000000 + Math.floor(Math.random() * 9000000)),
      username: `m_user3_${testSuffix}`,
      firstName: `MasterUser3_${testSuffix}`,
      gender: "MALE",
      pointsBalance: 50,
      isBanned: true,
      banReason: "Master test ban enforcement",
    },
  });

  let createdChatSessionId: string | null = null;
  let createdPackageId: string | null = null;
  let createdReportId: string | null = null;
  let createdBroadcastId: string | null = null;
  let createdReconnectId: string | null = null;

  try {
    // -------------------------------------------------------------
    // SECTION 1: POINT ECONOMY & CONCURRENCY
    // -------------------------------------------------------------
    console.log("\n--- SECTION 1: Points Economy & Atomic Integrity ---");
    
    // Add points
    const added = await addPoints(user1.id, 50, "ADMIN_ADJUSTMENT", "Test add points");
    assert(added === 200, "addPoints adds points correctly", `Expected 200, got ${added}`);

    // Spend points
    const spent = await spendPoints(user1.id, 30, "SAVE_PARTNER", "Test spend points");
    assert(spent.success === true && spent.balance === 170, "spendPoints deducts points correctly", `Expected 170, got ${spent.balance}`);

    // Overspend prevention
    const overspend = await spendPoints(user1.id, 999999, "VIP_PURCHASE");
    assert(overspend.success === false && overspend.reason === "INSUFFICIENT_FUNDS", "Overspend blocked cleanly");

    // Negative prevention
    let negBlocked = false;
    try {
      await addPoints(user1.id, -10, "ADMIN_ADJUSTMENT");
    } catch {
      negBlocked = true;
    }
    assert(negBlocked, "Negative addPoints blocked");

    // Daily reward & 24h cooldown
    const daily1 = await claimDailyReward(user1.id);
    assert(daily1.success === true, "First claimDailyReward succeeds");

    const daily2 = await claimDailyReward(user1.id);
    assert(daily2.success === false && daily2.reason === "COOLDOWN_ACTIVE", "Second claimDailyReward rejected by cooldown");

    // Referral processing
    const refResult = await processReferral(user2.id, `REF_M1_${testSuffix}`);
    assert(refResult.success === true, "processReferral succeeds for new user");

    const refDuplicate = await processReferral(user2.id, `REF_M1_${testSuffix}`);
    assert(refDuplicate.success === false && refDuplicate.reason === "ALREADY_REFERRED", "Duplicate referral rejected");

    // Chat completion reward
    await rewardChatCompletion(user1.id);
    await rewardChatCompletion(user2.id);
    const u1Post = await prisma.user.findUnique({ where: { id: user1.id } });
    assert((u1Post?.pointsBalance ?? 0) > 200, "rewardChatCompletion credited active chat points");

    // -------------------------------------------------------------
    // SECTION 2: MATCHING QUEUE, SESSIONS & TRANSCRIPTS
    // -------------------------------------------------------------
    console.log("\n--- SECTION 2: Matching Engine & Chat Transcripts ---");

    // Banned user check
    const banCheck = await checkUserBan(Number(user3.telegramUserId));
    assert(banCheck.isBanned === true, "checkUserBan detects banned user");

    // Matching queue entries
    await prisma.matchingQueue.create({
      data: { userId: user1.id, status: "WAITING" },
    });
    await prisma.matchingQueue.create({
      data: { userId: user2.id, status: "WAITING" },
    });

    const matchResult = await findAndCreateMatch(user1.id);
    assert(matchResult !== null && matchResult.partnerUserId === user2.id, "findAndCreateMatch pairs waiting users atomically");

    // Active session lookup
    const activeSession = await prisma.chatSession.findFirst({
      where: {
        status: "ACTIVE",
        OR: [
          { userOneId: user1.id, userTwoId: user2.id },
          { userOneId: user2.id, userTwoId: user1.id },
        ],
      },
    });
    assert(activeSession !== null, "ChatSession created with ACTIVE status");
    if (activeSession) createdChatSessionId = activeSession.id;

    // Chat messages
    if (activeSession) {
      const msg1 = await prisma.chatMessage.create({
        data: {
          chatSessionId: activeSession.id,
          senderId: user1.id,
          receiverId: user2.id,
          messageType: "TEXT",
          text: "Hello from Master Test User 1!",
        },
      });

      const msg2 = await prisma.chatMessage.create({
        data: {
          chatSessionId: activeSession.id,
          senderId: user2.id,
          receiverId: user1.id,
          messageType: "TEXT",
          text: "Hi back from User 2!",
        },
      });

      const messagesCount = await prisma.chatMessage.count({
        where: { chatSessionId: activeSession.id },
      });
      assert(messagesCount === 2, "ChatMessage logged 2 messages in transcript");
    }

    // Previous partners
    await savePreviousPartner(user1.id, user2.id);
    const prevPartner = await getPreviousPartner(user1.id);
    assert(prevPartner !== null, "savePreviousPartner saved relationship");
    const partnerId = prevPartner ? getPreviousPartnerId(prevPartner, user1.id) : null;
    assert(partnerId === user2.id, "getPreviousPartnerId resolves partner user ID correctly");

    // Reconnect requests
    const reconnectReq = await prisma.reconnectRequest.create({
      data: {
        senderId: user1.id,
        receiverId: user2.id,
        status: "PENDING",
      },
    });
    createdReconnectId = reconnectReq.id;
    assert(reconnectReq.status === "PENDING", "ReconnectRequest created as PENDING");

    // End chat session
    if (activeSession) {
      await prisma.chatSession.update({
        where: { id: activeSession.id },
        data: { status: "ENDED", endedAt: new Date(), endReason: "TEST_COMPLETED" },
      });
      const checkEnded = await prisma.chatSession.findUnique({ where: { id: activeSession.id } });
      assert(checkEnded?.status === "ENDED", "ChatSession successfully ended");
    }

    // -------------------------------------------------------------
    // SECTION 3: STORE PACKAGES, PAYMENTS & VIP
    // -------------------------------------------------------------
    console.log("\n--- SECTION 3: Store Packages, Payments & VIP ---");

    const pkg = await prisma.pointsPackage.create({
      data: {
        name: `Master Test Pack ${testSuffix}`,
        points: 500,
        priceUsd: 4.99,
        starsPrice: 250,
      },
    });
    createdPackageId = pkg.id;
    assert(pkg.id !== undefined, "PointsPackage created successfully");

    const buyPkg = await processPackagePayment(user1.id, pkg.id, "TEST_STARS");
    assert(buyPkg.success === true, "processPackagePayment processes purchase successfully");

    // VIP grant
    const vipExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const vipUser = await prisma.user.update({
      where: { id: user1.id },
      data: { isVip: true, vipExpiresAt: vipExpires, activeVipPlan: "VIP_7_DAYS" },
    });
    assert(vipUser.isVip === true && vipUser.activeVipPlan === "VIP_7_DAYS", "User VIP activated successfully");

    // -------------------------------------------------------------
    // SECTION 4: ABUSE REPORTS & MODERATION
    // -------------------------------------------------------------
    console.log("\n--- SECTION 4: Abuse Reports & Moderation ---");

    const report = await prisma.userReport.create({
      data: {
        reporterId: user2.id,
        reportedUserId: user1.id,
        reason: "Test report spam",
        status: "PENDING",
      },
    });
    createdReportId = report.id;
    assert(report.status === "PENDING", "UserReport created as PENDING");

    // Dismiss report via API
    const dismissRes = await fetch(`${BASE_URL}/api/admin/reports`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId: report.id, action: "DISMISS" }),
    });
    const dismissData = await dismissRes.json();
    assert(dismissData.success === true, "PATCH /api/admin/reports (DISMISS) succeeds");

    // -------------------------------------------------------------
    // SECTION 5: PUSH BROADCAST & AUDIT LOGS
    // -------------------------------------------------------------
    console.log("\n--- SECTION 5: Push Broadcast & System Settings ---");

    const broadcastRes = await fetch(`${BASE_URL}/api/admin/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Master Broadcast ${testSuffix}`,
        message: "Master test broadcast payload",
        targetAudience: "VIP_ONLY",
      }),
    });
    const broadcastData = await broadcastRes.json();
    assert(broadcastData.success === true, "POST /api/admin/broadcast succeeds");
    if (broadcastData.broadcast) createdBroadcastId = broadcastData.broadcast.id;

    // Dynamic settings
    const settingVal = await getSystemIntSetting("DAILY_REWARD_POINTS", 25);
    assert(typeof settingVal === "number", "getSystemIntSetting retrieves integer setting");

    await logAdminAction("MASTER_TEST_ACTION", { testSuffix });
    const auditCount = await prisma.adminAuditLog.count({
      where: { action: "MASTER_TEST_ACTION" },
    });
    assert(auditCount > 0, "logAdminAction records administrative audit trail");

    // -------------------------------------------------------------
    // SECTION 6: ALL REST API ENDPOINTS
    // -------------------------------------------------------------
    console.log("\n--- SECTION 6: Admin REST API Endpoints ---");

    const apiEndpoints = [
      { url: `${BASE_URL}/api/admin/stats`, method: "GET", name: "GET /api/admin/stats" },
      { url: `${BASE_URL}/api/admin/users`, method: "GET", name: "GET /api/admin/users" },
      { url: `${BASE_URL}/api/admin/payments`, method: "GET", name: "GET /api/admin/payments" },
      { url: `${BASE_URL}/api/admin/chats`, method: "GET", name: "GET /api/admin/chats" },
      { url: `${BASE_URL}/api/admin/queue`, method: "GET", name: "GET /api/admin/queue" },
      { url: `${BASE_URL}/api/admin/vip`, method: "GET", name: "GET /api/admin/vip" },
      { url: `${BASE_URL}/api/admin/media`, method: "GET", name: "GET /api/admin/media" },
      { url: `${BASE_URL}/api/admin/broadcast`, method: "GET", name: "GET /api/admin/broadcast" },
      { url: `${BASE_URL}/api/admin/reports`, method: "GET", name: "GET /api/admin/reports" },
      { url: `${BASE_URL}/api/admin/settings`, method: "GET", name: "GET /api/admin/settings" },
      { url: `${BASE_URL}/api/admin/reconnect`, method: "GET", name: "GET /api/admin/reconnect" },
      { url: `${BASE_URL}/api/admin/database`, method: "GET", name: "GET /api/admin/database" },
      { url: `${BASE_URL}/api/telegram/webhook`, method: "GET", name: "GET /api/telegram/webhook" },
    ];

    for (const ep of apiEndpoints) {
      const res = await fetch(ep.url);
      const json = await res.json();
      assert(res.status === 200 && json.success !== false, `${ep.name} returns HTTP 200 with success`, `Status: ${res.status}`);
    }

    // -------------------------------------------------------------
    // SECTION 7: ALL 13 FRONTEND PAGES
    // -------------------------------------------------------------
    console.log("\n--- SECTION 7: All 13 Frontend Web Routes ---");

    const pages = [
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
      "/admin/reconnect",
      "/admin/settings",
      "/admin/database",
    ];

    for (const path of pages) {
      const res = await fetch(`${BASE_URL}${path}`);
      const html = await res.text();
      assert(
        res.status === 200 && !html.includes("Internal Server Error"),
        `Route ${path} renders cleanly (200 OK)`,
        `HTTP ${res.status}, Length: ${html.length}`
      );
    }

  } finally {
    // Cleanup test data
    console.log("\n--- Cleaning up master test artifacts ---");
    if (createdBroadcastId) {
      await prisma.broadcastMessage.deleteMany({ where: { id: createdBroadcastId } });
    }
    if (createdReportId) {
      await prisma.userReport.deleteMany({ where: { id: createdReportId } });
    }
    if (createdReconnectId) {
      await prisma.reconnectRequest.deleteMany({ where: { id: createdReconnectId } });
    }
    if (createdPackageId) {
      await prisma.paymentTransaction.deleteMany({ where: { packageId: createdPackageId } });
      await prisma.pointsPackage.deleteMany({ where: { id: createdPackageId } });
    }
    if (createdChatSessionId) {
      await prisma.chatMessage.deleteMany({ where: { chatSessionId: createdChatSessionId } });
      await prisma.chatSession.deleteMany({ where: { id: createdChatSessionId } });
    }

    await prisma.previousPartner.deleteMany({
      where: {
        OR: [
          { userOneId: user1.id },
          { userTwoId: user1.id },
          { userOneId: user2.id },
          { userTwoId: user2.id },
        ],
      },
    });

    await prisma.pointsTransaction.deleteMany({
      where: { userId: { in: [user1.id, user2.id, user3.id] } },
    });
    await prisma.matchingQueue.deleteMany({
      where: { userId: { in: [user1.id, user2.id, user3.id] } },
    });
    await prisma.adminAuditLog.deleteMany({
      where: { details: { contains: testSuffix } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [user1.id, user2.id, user3.id] } },
    });
    console.log("Master test cleanup complete.");
  }

  console.log("\n=================================================================");
  console.log(`   MASTER SYSTEM TEST RESULT: ${passedTests}/${totalTests} PASSED   `);
  console.log("=================================================================");

  if (errors.length > 0) {
    console.error(`\nEncountered ${errors.length} errors:`);
    errors.forEach((e) => console.error(` - ${e}`));
    process.exit(1);
  }
}

runMasterTest().catch((err) => {
  console.error("Unhandled error in master test suite:", err);
  process.exit(1);
});
