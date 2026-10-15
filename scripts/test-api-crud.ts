import "dotenv/config";

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

async function runApiTests() {
  console.log("=================================================");
  console.log("🌐 STARTING ADMIN REST API & CRUD TEST SUITE");
  console.log(`🎯 Targeting Server: ${BASE_URL}`);
  console.log("=================================================\n");

  let createdUserId = "";
  let createdPkgId = "";
  let createdPaymentId = "";

  try {
    // -----------------------------------------------------------------
    // API TEST 1: Stats Endpoint
    // -----------------------------------------------------------------
    console.log("🔹 [API 1] Testing GET /api/admin/stats...");
    const statsRes = await fetch(`${BASE_URL}/api/admin/stats`);
    const statsData = await statsRes.json();
    if (!statsData.success || typeof statsData.stats.totalUsers !== "number") {
      throw new Error(`Stats endpoint failed: ${JSON.stringify(statsData)}`);
    }
    console.log(`✅ Stats OK (Users: ${statsData.stats.totalUsers}, Revenue: $${statsData.stats.totalRevenueUsd})`);

    // -----------------------------------------------------------------
    // API TEST 2: Users CRUD (Create, Read, Update, Delete)
    // -----------------------------------------------------------------
    console.log("\n🔹 [API 2] Testing User CRUD (/api/admin/users)...");
    // CREATE
    const createUserRes = await fetch(`${BASE_URL}/api/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegramUserId: String(Date.now()).slice(-9),
        firstName: "ApiTestUser",
        gender: "Non-binary",
        pointsBalance: 250,
      }),
    });
    const createUserData = await createUserRes.json();
    if (!createUserData.success || !createUserData.user?.id) {
      throw new Error(`User creation failed: ${JSON.stringify(createUserData)}`);
    }
    createdUserId = createUserData.user.id;
    console.log(`✅ Created User: ${createdUserId} (${createUserData.user.firstName})`);

    // READ
    const getUsersRes = await fetch(`${BASE_URL}/api/admin/users?query=ApiTestUser`);
    const getUsersData = await getUsersRes.json();
    if (!getUsersData.success || getUsersData.users.length === 0) {
      throw new Error(`User search failed: ${JSON.stringify(getUsersData)}`);
    }
    console.log(`✅ Read User OK (Found: ${getUsersData.users[0].firstName})`);

    // UPDATE (Adjust Points, Role, Ban)
    const updateUserRes = await fetch(`${BASE_URL}/api/admin/users`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: createdUserId,
        pointsDelta: 50,
        pointsReason: "API Test Reward",
        role: "ADMIN",
        isBanned: true,
        banReason: "Temporary test suspension",
      }),
    });
    const updateUserData = await updateUserRes.json();
    if (!updateUserData.success || updateUserData.user.pointsBalance !== 300) {
      throw new Error(`User update failed: ${JSON.stringify(updateUserData)}`);
    }
    console.log(`✅ Updated User OK (New Balance: ${updateUserData.user.pointsBalance}, Role: ${updateUserData.user.role}, Banned: ${updateUserData.user.isBanned})`);

    // -----------------------------------------------------------------
    // API TEST 3: Points Packages CRUD (/api/admin/payments)
    // -----------------------------------------------------------------
    console.log("\n🔹 [API 3] Testing Points Packages CRUD (/api/admin/payments)...");
    // CREATE PACKAGE
    const createPkgRes = await fetch(`${BASE_URL}/api/admin/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_package",
        name: "API Test Mega Pack",
        description: "Created by automated API test",
        points: 5000,
        priceUsd: 29.99,
        starsPrice: 1500,
        badge: "Special API",
        isActive: true,
      }),
    });
    const createPkgData = await createPkgRes.json();
    if (!createPkgData.success || !createPkgData.package?.id) {
      throw new Error(`Package creation failed: ${JSON.stringify(createPkgData)}`);
    }
    createdPkgId = createPkgData.package.id;
    console.log(`✅ Created Package: ${createdPkgId} (${createPkgData.package.name})`);

    // UPDATE PACKAGE
    const updatePkgRes = await fetch(`${BASE_URL}/api/admin/payments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_package",
        packageId: createdPkgId,
        points: 6000,
        priceUsd: 34.99,
      }),
    });
    const updatePkgData = await updatePkgRes.json();
    if (!updatePkgData.success || updatePkgData.package.points !== 6000) {
      throw new Error(`Package update failed: ${JSON.stringify(updatePkgData)}`);
    }
    console.log(`✅ Updated Package OK (Points: ${updatePkgData.package.points}, Price: $${updatePkgData.package.priceUsd})`);

    // DELETE PACKAGE
    const deletePkgRes = await fetch(`${BASE_URL}/api/admin/payments?packageId=${createdPkgId}`, {
      method: "DELETE",
    });
    const deletePkgData = await deletePkgRes.json();
    if (!deletePkgData.success) {
      throw new Error(`Package deletion failed: ${JSON.stringify(deletePkgData)}`);
    }
    console.log(`✅ Deleted Package OK: ${createdPkgId}`);

    // -----------------------------------------------------------------
    // API TEST 4: Manual Payment Credit & Transaction Audit
    // -----------------------------------------------------------------
    console.log("\n🔹 [API 4] Testing Manual Payment Credit & Audit Log...");
    const creditRes = await fetch(`${BASE_URL}/api/admin/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "manual_payment",
        userId: createdUserId,
        pointsAmount: 200,
        amountPaid: 1.99,
        provider: "ADMIN_STRIPE_TEST",
        description: "API Test Payment Credit",
      }),
    });
    const creditData = await creditRes.json();
    if (!creditData.success || !creditData.payment?.id) {
      throw new Error(`Manual credit failed: ${JSON.stringify(creditData)}`);
    }
    createdPaymentId = creditData.payment.id;
    console.log(`✅ Manual Payment Credit Recorded: ${createdPaymentId} (+200 pts)`);

    // Update status to REFUNDED
    const refundRes = await fetch(`${BASE_URL}/api/admin/payments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_transaction",
        transactionId: createdPaymentId,
        status: "REFUNDED",
      }),
    });
    const refundData = await refundRes.json();
    if (!refundData.success || refundData.transaction.status !== "REFUNDED") {
      throw new Error(`Refund status update failed: ${JSON.stringify(refundData)}`);
    }
    console.log(`✅ Transaction Status Updated to REFUNDED`);

    // -----------------------------------------------------------------
    // API TEST 5: VIP Grant & Revoke API (/api/admin/vip)
    // -----------------------------------------------------------------
    console.log("\n🔹 [API 5] Testing VIP Grant & Revoke (/api/admin/vip)...");
    const grantVipRes = await fetch(`${BASE_URL}/api/admin/vip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: createdUserId,
        planLabel: "API VIP Pass",
        durationDays: 14,
      }),
    });
    const grantVipData = await grantVipRes.json();
    if (!grantVipData.success || !grantVipData.user.isVip) {
      throw new Error(`Grant VIP failed: ${JSON.stringify(grantVipData)}`);
    }
    console.log(`✅ Granted VIP via API to user: Active: ${grantVipData.user.isVip}`);

    const revokeVipRes = await fetch(`${BASE_URL}/api/admin/vip?userId=${createdUserId}`, {
      method: "DELETE",
    });
    const revokeVipData = await revokeVipRes.json();
    if (!revokeVipData.success || revokeVipData.user.isVip) {
      throw new Error(`Revoke VIP failed: ${JSON.stringify(revokeVipData)}`);
    }
    console.log(`✅ Revoked VIP via API: Active: ${revokeVipData.user.isVip}`);

    // -----------------------------------------------------------------
    // API TEST 6: Queue & Chats Endpoints
    // -----------------------------------------------------------------
    console.log("\n🔹 [API 6] Testing Queue, Chats, and Media Endpoints...");
    const queueRes = await fetch(`${BASE_URL}/api/admin/queue`);
    const queueData = await queueRes.json();
    if (!queueData.success) throw new Error("GET /api/admin/queue failed");
    console.log(`✅ Queue API OK (${queueData.queue.length} in queue)`);

    const chatsRes = await fetch(`${BASE_URL}/api/admin/chats`);
    const chatsData = await chatsRes.json();
    if (!chatsData.success) throw new Error("GET /api/admin/chats failed");
    console.log(`✅ Chats API OK (${chatsData.sessions.length} sessions listed)`);

    const mediaRes = await fetch(`${BASE_URL}/api/admin/media`);
    const mediaData = await mediaRes.json();
    if (!mediaData.success) throw new Error("GET /api/admin/media failed");
    console.log(`✅ Media API OK (${mediaData.media.length} items listed)`);

    const webhookRes = await fetch(`${BASE_URL}/api/telegram/webhook`);
    const webhookData = await webhookRes.json();
    if (webhookData.status !== "ok") throw new Error("GET /api/telegram/webhook failed");
    console.log(`✅ Telegram Webhook Endpoint OK (${webhookData.message})`);

    // -----------------------------------------------------------------
    // CLEANUP USER
    // -----------------------------------------------------------------
    console.log("\n🔹 [CLEANUP] Deleting Created Test User via DELETE /api/admin/users...");
    const deleteUserRes = await fetch(`${BASE_URL}/api/admin/users?userId=${createdUserId}`, {
      method: "DELETE",
    });
    const deleteUserData = await deleteUserRes.json();
    if (!deleteUserData.success) {
      throw new Error(`User deletion failed: ${JSON.stringify(deleteUserData)}`);
    }
    console.log(`✅ Deleted Test User: ${createdUserId}`);

    console.log("\n=================================================");
    console.log("🎉 ALL REST API & CRUD TESTS PASSED 100%!");
    console.log("=================================================\n");

  } catch (err: any) {
    console.error("❌ API TEST FAILED:", err);
    process.exit(1);
  }
}

runApiTests();
