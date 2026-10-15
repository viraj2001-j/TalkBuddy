import prisma from "../lib/db";
import {
  getUserVipStatus,
  purchaseVipWithPoints,
  createPendingOrder,
  validatePreCheckoutQuery,
  fulfillSuccessfulPayment,
  refundTelegramStarsPayment,
  syncUserVipExpiration,
  VIP_PLANS,
} from "../lib/telegram/vip";
import { findAndCreateMatch } from "../lib/telegram/matching";

async function runTestSuite() {
  console.log("==========================================================");
  console.log("🚀 STARTING TALKBUDDY VIP & PAYMENT SYSTEM AUDIT & TESTS");
  console.log("==========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, details ? details : "");
      failed++;
    }
  }

  const testTelegramIdFree = BigInt(99000101);
  const testTelegramIdVip = BigInt(99000102);
  const testTelegramIdPartner = BigInt(99000103);

  // Setup / Clean previous test users
  await prisma.user.deleteMany({
    where: {
      telegramUserId: {
        in: [
          testTelegramIdFree,
          testTelegramIdVip,
          testTelegramIdPartner,
          BigInt(99000104),
        ],
      },
    },
  });

  // 1. Create Free User
  const freeUser = await prisma.user.create({
    data: {
      telegramUserId: testTelegramIdFree,
      firstName: "FreeTester",
      gender: "Male",
      pointsBalance: 120, // Has 120 points
      isVip: false,
      isProfileComplete: true,
      age: 25,
      country: "Sri Lanka",
    },
  });

  // Test 1: A free user sees the correct existing points or balance
  const freeStatus = await getUserVipStatus(freeUser.id);
  assert(
    freeStatus.pointsBalance === 120 && freeStatus.isVip === false && freeStatus.vipExpiresAt === null,
    "Test 1: Free user retrieves verified points balance (120) and is not VIP"
  );

  // Test 2: User selects a valid package
  const pkg1w = await prisma.vipPackage.findUnique({ where: { key: "1w" } });
  assert(
    pkg1w !== null && pkg1w.pointsCost === 80 && pkg1w.starsPrice === 50 && pkg1w.durationDays === 7,
    "Test 2: System retrieves valid VIP package from database (1 Week = 80 pts / ⭐50 Stars)"
  );

  // Test 3: A pending purchase does not activate VIP
  const pendingOrder = await createPendingOrder({
    userId: freeUser.id,
    orderType: "VIP_SUBSCRIPTION",
    packageIdOrKey: "1w",
    paymentMethod: "TELEGRAM_STARS",
  });

  const statusAfterPending = await getUserVipStatus(freeUser.id);
  assert(
    pendingOrder.orderId !== undefined &&
      pendingOrder.starsAmount === 50 &&
      statusAfterPending.isVip === false,
    "Test 3: Creating a pending order does NOT prematurely activate VIP"
  );

  // Test 4: Pre-checkout validation checks amount and currency
  const invalidCurrencyCheck = await validatePreCheckoutQuery(
    pendingOrder.orderPayload,
    50,
    "USD" // invalid currency
  );
  assert(
    invalidCurrencyCheck.isValid === false,
    "Test 4a: Pre-checkout rejects non-XTR currency"
  );

  const invalidAmountCheck = await validatePreCheckoutQuery(
    pendingOrder.orderPayload,
    999, // wrong amount
    "XTR"
  );
  assert(
    invalidAmountCheck.isValid === false,
    "Test 4b: Pre-checkout rejects incorrect Stars amount"
  );

  const validPreCheckout = await validatePreCheckoutQuery(
    pendingOrder.orderPayload,
    50,
    "XTR"
  );
  assert(
    validPreCheckout.isValid === true,
    "Test 4c: Pre-checkout approves valid order payload and exact Stars amount"
  );

  // Test 5: A verified successful payment activates the correct package
  const mockChargeId1 = `tg_charge_${Date.now()}_001`;
  const paymentResult = await fulfillSuccessfulPayment({
    telegramUserId: freeUser.telegramUserId,
    telegramPaymentChargeId: mockChargeId1,
    orderPayload: pendingOrder.orderPayload,
    totalAmountStars: 50,
    currency: "XTR",
  });

  const statusAfterPayment = await getUserVipStatus(freeUser.id);
  const subscription1 = await prisma.vipSubscription.findFirst({
    where: { userId: freeUser.id, status: "ACTIVE" },
  });

  assert(
    paymentResult.success === true &&
      paymentResult.isDuplicate === false &&
      statusAfterPayment.isVip === true &&
      subscription1 !== null &&
      subscription1.paymentMethod === "TELEGRAM_STARS" &&
      subscription1.costAmount === 50 &&
      subscription1.currency === "XTR",
    "Test 5: Verified successful Stars payment activates VIP with persistent VipSubscription"
  );

  // Test 6: A duplicated payment notification does not duplicate the purchase or subscription (Idempotency)
  const duplicateResult = await fulfillSuccessfulPayment({
    telegramUserId: freeUser.telegramUserId,
    telegramPaymentChargeId: mockChargeId1,
    orderPayload: pendingOrder.orderPayload,
    totalAmountStars: 50,
    currency: "XTR",
  });

  const subsCount = await prisma.vipSubscription.count({
    where: { userId: freeUser.id },
  });

  assert(
    duplicateResult.isDuplicate === true && subsCount === 1,
    "Test 6: Duplicate payment webhook is idempotent and prevents duplicate subscription"
  );

  // Test 7: Renewal extension policy (Overlapping packages)
  // FreeUser (now VIP with ~7 days remaining) buys another 1 Week package with Points (80 pts)
  const initialExpiresAt = statusAfterPayment.vipExpiresAt!;
  const renewalResult = await purchaseVipWithPoints(freeUser.id, "1w");

  const statusAfterRenewal = await getUserVipStatus(freeUser.id);
  const expectedExtendedMs = initialExpiresAt.getTime() + 7 * 24 * 60 * 60 * 1000;
  const actualExpiresMs = statusAfterRenewal.vipExpiresAt!.getTime();
  const diffHours = Math.abs(actualExpiresMs - expectedExtendedMs) / (60 * 60 * 1000);

  assert(
    renewalResult.success === true &&
      freeUser.pointsBalance - 80 === statusAfterRenewal.pointsBalance &&
      diffHours < 1,
    "Test 7: VIP renewal while active seamlessly extends remaining days without reset"
  );

  // Test 8: Insufficient Points purchase rejection
  // FreeUser has 40 points left. Trying to buy 1 Month VIP (250 pts) should fail with INSUFFICIENT_FUNDS
  const insufficientResult = await purchaseVipWithPoints(freeUser.id, "1m");
  assert(
    insufficientResult.success === false && insufficientResult.reason === "INSUFFICIENT_FUNDS",
    "Test 8: VIP points purchase rejected if points balance is insufficient"
  );

  // Test 9: VIP-only Matching Filters and Access Control
  // Setup Partner user waiting in queue (Female)
  const partnerUser = await prisma.user.create({
    data: {
      telegramUserId: testTelegramIdPartner,
      firstName: "AliceFemale",
      gender: "Female",
      age: 23,
      country: "Sri Lanka",
      isVip: false,
      isProfileComplete: true,
    },
  });

  await prisma.matchingQueue.upsert({
    where: { userId: partnerUser.id },
    update: { status: "WAITING", partnerUserId: null, joinedAt: new Date() },
    create: { userId: partnerUser.id, status: "WAITING" },
  });

  // FreeUser (VIP) requests Female partner
  await prisma.user.update({
    where: { id: freeUser.id },
    data: {
      genderFilterPreference: "Female",
      countryFilterPreference: "Sri Lanka",
    },
  });

  const vipMatch = await findAndCreateMatch(freeUser.id);
  assert(
    vipMatch !== null && vipMatch.partnerUserId === partnerUser.id,
    "Test 9: Eligible VIP user successfully matches using VIP Gender and Country filters"
  );

  // Clean up match
  await prisma.chatSession.deleteMany({
    where: {
      OR: [
        { userOneId: freeUser.id, userTwoId: partnerUser.id },
        { userOneId: partnerUser.id, userTwoId: freeUser.id },
      ],
    },
  });
  await prisma.matchingQueue.deleteMany({
    where: { userId: { in: [freeUser.id, partnerUser.id] } },
  });

  // Test 10: Automatic Expiration & Immediate Access Loss
  // Set user VIP expiration to yesterday
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: freeUser.id },
    data: { isVip: true, vipExpiresAt: yesterday },
  });

  const expiredStatus = await getUserVipStatus(freeUser.id);
  assert(
    expiredStatus.isVip === false,
    "Test 10: Expired user is immediately revoked on backend during status check"
  );

  // Test 11: Expired user cannot use VIP filters
  await prisma.matchingQueue.upsert({
    where: { userId: partnerUser.id },
    update: { status: "WAITING", partnerUserId: null, joinedAt: new Date() },
    create: { userId: partnerUser.id, status: "WAITING" },
  });

  // Partner user is Female. Put Male user into queue as well
  const malePartner = await prisma.user.create({
    data: {
      telegramUserId: BigInt(99000104),
      firstName: "BobMale",
      gender: "Male",
      age: 24,
      country: "Sri Lanka",
      isVip: false,
      isProfileComplete: true,
    },
  });

  // Make Bob the older row in queue
  await prisma.matchingQueue.upsert({
    where: { userId: malePartner.id },
    update: { status: "WAITING", partnerUserId: null, joinedAt: new Date(Date.now() - 10000) },
    create: { userId: malePartner.id, status: "WAITING", joinedAt: new Date(Date.now() - 10000) },
  });

  // FreeUser (now expired) has genderFilterPreference: "Female", but since they are expired,
  // the filter must be ignored and they match the oldest user (BobMale)!
  const expiredMatch = await findAndCreateMatch(freeUser.id);
  assert(
    expiredMatch !== null && expiredMatch.partnerUserId === malePartner.id,
    "Test 11: Expired user cannot bypass access restriction; premium filter is ignored"
  );

  // Clean up Bob
  await prisma.chatSession.deleteMany({ where: { OR: [{ userOneId: freeUser.id }, { userTwoId: freeUser.id }] } });
  await prisma.matchingQueue.deleteMany({ where: { userId: { in: [freeUser.id, partnerUser.id, malePartner.id] } } });
  await prisma.user.delete({ where: { id: malePartner.id } });

  // Test 12: New purchase after expiration activates cleanly from now
  const newOrder = await createPendingOrder({
    userId: freeUser.id,
    orderType: "VIP_SUBSCRIPTION",
    packageIdOrKey: "1w",
    paymentMethod: "TELEGRAM_STARS",
  });

  const mockChargeId2 = `tg_charge_${Date.now()}_002`;
  await fulfillSuccessfulPayment({
    telegramUserId: freeUser.telegramUserId,
    telegramPaymentChargeId: mockChargeId2,
    orderPayload: newOrder.orderPayload,
    totalAmountStars: 50,
    currency: "XTR",
  });

  const reactivatedStatus = await getUserVipStatus(freeUser.id);
  assert(
    reactivatedStatus.isVip === true &&
      reactivatedStatus.vipExpiresAt! > new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    "Test 12: New purchase after expiration reactivates VIP starting freshly from now"
  );

  // Test 13: Telegram Stars Refund Flow
  // Refund charge 2
  const txToRefund = await prisma.paymentTransaction.findUnique({
    where: { telegramPaymentChargeId: mockChargeId2 },
  });

  const refundResult = await refundTelegramStarsPayment(
    txToRefund!.id,
    "Testing automated refund",
    async () => true // mock successful telegram API call
  );

  const txAfterRefund = await prisma.paymentTransaction.findUnique({
    where: { id: txToRefund!.id },
  });
  const subAfterRefund = await prisma.vipSubscription.findUnique({
    where: { paymentTransactionId: txToRefund!.id },
  });

  assert(
    refundResult.success === true &&
      txAfterRefund?.status === "REFUNDED" &&
      txAfterRefund.isRefunded === true &&
      subAfterRefund?.status === "REFUNDED",
    "Test 13: Refund successfully marks PaymentTransaction and VipSubscription as REFUNDED"
  );

  // Test 14: Historical purchase records remain available
  const allUserPurchases = await prisma.paymentTransaction.findMany({
    where: { userId: freeUser.id },
    orderBy: { createdAt: "desc" },
  });

  assert(
    allUserPurchases.length >= 3,
    `Test 14: Historical purchase records remain permanently available (${allUserPurchases.length} found)`
  );

  // Test 15: Points package purchase via Stars credits verified points
  const pointsPkg = await prisma.pointsPackage.findFirst({ where: { isActive: true } });
  const pointsOrder = await createPendingOrder({
    userId: freeUser.id,
    orderType: "POINTS_PACKAGE",
    packageIdOrKey: pointsPkg!.id,
    paymentMethod: "TELEGRAM_STARS",
  });

  const prevBalance = (await getUserVipStatus(freeUser.id)).pointsBalance;
  const mockChargeId3 = `tg_charge_${Date.now()}_003`;
  const pointsResult = await fulfillSuccessfulPayment({
    telegramUserId: freeUser.telegramUserId,
    telegramPaymentChargeId: mockChargeId3,
    orderPayload: pointsOrder.orderPayload,
    totalAmountStars: pointsPkg!.starsPrice,
    currency: "XTR",
  });

  const newBalance = (await getUserVipStatus(freeUser.id)).pointsBalance;
  assert(
    pointsResult.success === true && newBalance === prevBalance + pointsPkg!.points,
    `Test 15: Verified Stars purchase of Points Package accurately credits +${pointsPkg!.points} pts`
  );

  // Clean test records
  await prisma.user.deleteMany({
    where: {
      telegramUserId: { in: [testTelegramIdFree, testTelegramIdVip, testTelegramIdPartner] },
    },
  });

  console.log("\n==========================================================");
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("==========================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed with fatal error:", err);
  process.exit(1);
});
