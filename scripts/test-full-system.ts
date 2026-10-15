import "dotenv/config";
import prisma from "../lib/db";
import {
  claimDailyReward,
  processReferral,
  rewardChatCompletion,
  spendPoints,
  addPoints,
  getPointsBalance,
  processPackagePayment,
} from "../lib/telegram/points";
import {
  getUserVipStatus,
  purchaseVipWithPoints,
  VIP_PLANS,
} from "../lib/telegram/vip";
import { findAndCreateMatch } from "../lib/telegram/matching";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 STARTING FULL TALKBUDDY SYSTEM E2E TEST SUITE");
  console.log("=================================================\n");

  let testUser1Id = "";
  let testUser2Id = "";
  let testPackageId = "";
  let testSessionId = "";
  let testPaymentId = "";

  try {
    // -----------------------------------------------------------------
    // TEST 1: User Creation & Points Verification
    // -----------------------------------------------------------------
    console.log("🔹 [TEST 1] Creating Test Users & Checking Welcome Balance...");
    const user1 = await prisma.user.create({
      data: {
        telegramUserId: BigInt(888800001),
        firstName: "TestAlice",
        gender: "Female",
        pointsBalance: 100,
        referralCode: "ref_test_alice",
      },
    });
    testUser1Id = user1.id;

    const user2 = await prisma.user.create({
      data: {
        telegramUserId: BigInt(888800002),
        firstName: "TestBob",
        gender: "Male",
        pointsBalance: 100,
      },
    });
    testUser2Id = user2.id;

    console.log(`✅ User1 created (ID: ${user1.id}, Balance: ${user1.pointsBalance})`);
    console.log(`✅ User2 created (ID: ${user2.id}, Balance: ${user2.pointsBalance})`);

    // -----------------------------------------------------------------
    // TEST 2: Daily Reward Claim & 24h Cooldown Logic
    // -----------------------------------------------------------------
    console.log("\n🔹 [TEST 2] Testing Daily Reward Claim & 24h Cooldown...");
    const claim1 = await claimDailyReward(user1.id);
    if (!claim1.success || claim1.newBalance !== 125) {
      throw new Error(`Daily reward claim failed: ${JSON.stringify(claim1)}`);
    }
    console.log(`✅ First daily claim succeeded: +${claim1.rewardPoints} pts, new balance: ${claim1.newBalance}`);

    // Try claiming again immediately (must fail with cooldown)
    const claim2 = await claimDailyReward(user1.id);
    if (claim2.success || claim2.reason !== "COOLDOWN_ACTIVE") {
      throw new Error(`Daily reward cooldown failed to trigger: ${JSON.stringify(claim2)}`);
    }
    console.log(`✅ Cooldown enforced correctly: ${claim2.reason} (~${claim2.remainingHours}h remaining)`);

    // -----------------------------------------------------------------
    // TEST 3: Referral System
    // -----------------------------------------------------------------
    console.log("\n🔹 [TEST 3] Testing Referral Program...");
    const refResult = await processReferral(user2.id, "ref_test_alice");
    if (!refResult.success) {
      throw new Error(`Referral processing failed: ${JSON.stringify(refResult)}`);
    }

    const aliceBalanceAfterRef = await getPointsBalance(user1.id);
    const bobBalanceAfterRef = await getPointsBalance(user2.id);

    // Alice had 125 + 50 = 175
    // Bob had 100 + 25 = 125
    if (aliceBalanceAfterRef !== 175 || bobBalanceAfterRef !== 125) {
      throw new Error(`Referral point balances incorrect. Alice: ${aliceBalanceAfterRef}, Bob: ${bobBalanceAfterRef}`);
    }
    console.log(`✅ Referral applied: Referrer Alice = ${aliceBalanceAfterRef} pts (+50), Referee Bob = ${bobBalanceAfterRef} pts (+25)`);

    // Duplicate referral check
    const dupRef = await processReferral(user2.id, "ref_test_alice");
    if (dupRef.success || dupRef.reason !== "ALREADY_REFERRED") {
      throw new Error(`Duplicate referral check failed: ${JSON.stringify(dupRef)}`);
    }
    console.log(`✅ Duplicate referral blocked: ${dupRef.reason}`);

    // -----------------------------------------------------------------
    // TEST 4: Matching Queue & Chat Session Creation
    // -----------------------------------------------------------------
    console.log("\n🔹 [TEST 4] Testing Matching Queue & Atomic Matching Engine...");
    await prisma.matchingQueue.create({
      data: {
        userId: user1.id,
        status: "WAITING",
      },
    });

    const matchResult = await findAndCreateMatch(user2.id);
    if (!matchResult || matchResult.partnerUserId !== user1.id) {
      throw new Error(`Match creation failed: ${JSON.stringify(matchResult)}`);
    }

    const session = await prisma.chatSession.findFirst({
      where: {
        status: "ACTIVE",
        OR: [
          { userOneId: user1.id, userTwoId: user2.id },
          { userOneId: user2.id, userTwoId: user1.id },
        ],
      },
    });

    if (!session) {
      throw new Error("Active chat session not created in database!");
    }
    testSessionId = session.id;
    console.log(`✅ Matching engine created active chat session: ${session.id}`);

    // -----------------------------------------------------------------
    // TEST 5: Chat Message Logging & Persistence
    // -----------------------------------------------------------------
    console.log("\n🔹 [TEST 5] Testing Chat Message Persistence...");
    const msg1 = await prisma.chatMessage.create({
      data: {
        chatSessionId: session.id,
        senderId: user1.id,
        receiverId: user2.id,
        messageType: "TEXT",
        text: "Hello Bob! This is an anonymous test message.",
      },
    });

    const msg2 = await prisma.chatMessage.create({
      data: {
        chatSessionId: session.id,
        senderId: user2.id,
        receiverId: user1.id,
        messageType: "TEXT",
        text: "Hey Alice, received loud and clear!",
      },
    });

    const sessionMessages = await prisma.chatMessage.count({
      where: { chatSessionId: session.id },
    });

    if (sessionMessages !== 2) {
      throw new Error(`Expected 2 messages in session, got ${sessionMessages}`);
    }
    console.log(`✅ Messages logged successfully (${sessionMessages} messages in transcript)`);

    // -----------------------------------------------------------------
    // TEST 6: Chat Completion Reward & Session Termination
    // -----------------------------------------------------------------
    console.log("\n🔹 [TEST 6] Testing Session Ending & Chat Completion Reward...");
    await prisma.chatSession.update({
      where: { id: session.id },
      data: {
        status: "ENDED",
        endedAt: new Date(),
        endReason: "TEST_COMPLETED",
      },
    });

    await rewardChatCompletion(user1.id); // +5 pts
    await rewardChatCompletion(user2.id); // +5 pts

    const aliceAfterChat = await getPointsBalance(user1.id);
    const bobAfterChat = await getPointsBalance(user2.id);

    if (aliceAfterChat !== 180 || bobAfterChat !== 130) {
      throw new Error(`Chat completion balances incorrect. Alice: ${aliceAfterChat}, Bob: ${bobAfterChat}`);
    }
    console.log(`✅ Chat reward granted (+5 pts each): Alice = ${aliceAfterChat} pts, Bob = ${bobAfterChat} pts`);

    // -----------------------------------------------------------------
    // TEST 7: Points Spending & Insufficient Funds Check
    // -----------------------------------------------------------------
    console.log("\n🔹 [TEST 7] Testing Points Spending (Spend & Insufficient Funds)...");
    const spendSuccess = await spendPoints(user2.id, 10, "SAVE_PARTNER", "Saved partner nickname");
    if (!spendSuccess.success || spendSuccess.balance !== 120) {
      throw new Error(`Spend points failed: ${JSON.stringify(spendSuccess)}`);
    }
    console.log(`✅ Spent 10 points for partner save: remaining = ${spendSuccess.balance} pts`);

    const spendFail = await spendPoints(user2.id, 999999, "SAVE_PARTNER", "Overdraft attempt");
    if (spendFail.success || spendFail.reason !== "INSUFFICIENT_FUNDS") {
      throw new Error(`Overdraft protection failed: ${JSON.stringify(spendFail)}`);
    }
    console.log(`✅ Overdraft prevented correctly: ${spendFail.reason}`);

    // -----------------------------------------------------------------
    // TEST 8: Points Package Purchases & Payment Transactions
    // -----------------------------------------------------------------
    console.log("\n🔹 [TEST 8] Testing Points Package Purchase & Payment Transactions...");
    const samplePackage = await prisma.pointsPackage.findFirst({
      where: { isActive: true },
    });

    if (!samplePackage) {
      throw new Error("No active PointsPackage found in DB!");
    }

    const purchaseResult = await processPackagePayment(
      user1.id,
      samplePackage.id,
      "TELEGRAM_STARS",
      `test_stars_pay_${Date.now()}`
    );

    if (!purchaseResult.success) {
      throw new Error(`Package payment failed: ${JSON.stringify(purchaseResult)}`);
    }
    testPaymentId = purchaseResult.paymentId;

    const paymentRecord = await prisma.paymentTransaction.findUnique({
      where: { id: purchaseResult.paymentId },
    });

    if (!paymentRecord || paymentRecord.status !== "COMPLETED") {
      throw new Error(`Payment transaction not recorded properly: ${JSON.stringify(paymentRecord)}`);
    }
    console.log(`✅ Package purchase recorded: Payment ID ${paymentRecord.id}, Credited +${purchaseResult.pointsAdded} pts to Alice`);

    // -----------------------------------------------------------------
    // TEST 9: VIP Activation & Status Expiry Verification
    // -----------------------------------------------------------------
    console.log("\n🔹 [TEST 9] Testing VIP Membership Purchase with Points...");
    // Alice purchases 1 Week VIP (80 pts)
    const vipResult = await purchaseVipWithPoints(user1.id, "1w");
    if (!vipResult.success) {
      throw new Error(`VIP purchase failed: ${JSON.stringify(vipResult)}`);
    }

    const vipStatus = await getUserVipStatus(user1.id);
    if (!vipStatus.isVip || !vipStatus.vipExpiresAt) {
      throw new Error(`VIP status not active after purchase: ${JSON.stringify(vipStatus)}`);
    }
    console.log(`✅ VIP activated successfully! Active: ${vipStatus.isVip}, Expires: ${vipStatus.vipExpiresAt.toISOString()}`);

    console.log("\n=================================================");
    console.log("🎉 ALL 9 CORE SYSTEM WORKFLOW TESTS PASSED 100%!");
    console.log("=================================================\n");

  } catch (error: any) {
    console.error("❌ E2E TEST FAILED:", error);
    process.exit(1);
  } finally {
    // Clean up test data
    console.log("🧹 Cleaning up test artifacts from database...");
    if (testSessionId) {
      await prisma.chatMessage.deleteMany({ where: { chatSessionId: testSessionId } }).catch(() => {});
      await prisma.chatSession.delete({ where: { id: testSessionId } }).catch(() => {});
    }
    if (testUser1Id) {
      await prisma.matchingQueue.deleteMany({ where: { userId: testUser1Id } }).catch(() => {});
      await prisma.pointsTransaction.deleteMany({ where: { userId: testUser1Id } }).catch(() => {});
      await prisma.paymentTransaction.deleteMany({ where: { userId: testUser1Id } }).catch(() => {});
      await prisma.user.delete({ where: { id: testUser1Id } }).catch(() => {});
    }
    if (testUser2Id) {
      await prisma.matchingQueue.deleteMany({ where: { userId: testUser2Id } }).catch(() => {});
      await prisma.pointsTransaction.deleteMany({ where: { userId: testUser2Id } }).catch(() => {});
      await prisma.paymentTransaction.deleteMany({ where: { userId: testUser2Id } }).catch(() => {});
      await prisma.user.delete({ where: { id: testUser2Id } }).catch(() => {});
    }
    console.log("✅ Cleanup complete. Database is clean!");
    await prisma.$disconnect();
  }
}

runTests();
