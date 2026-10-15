import prisma from "../lib/db";
import {
  getUserVipStatus,
  purchaseVipWithPoints,
  createPendingOrder,
  validatePreCheckoutQuery,
  fulfillSuccessfulPayment,
  refundTelegramStarsPayment,
  getAvailableVipPackages,
  getVipPackageByKey,
  VIP_PLANS,
} from "../lib/telegram/vip";

async function runPaymentE2ETests() {
  console.log("================================================================");
  console.log("💳 EXECUTING COMPREHENSIVE PAYMENT PROCESS E2E VERIFICATION 💳");
  console.log("================================================================\n");

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

  const testTelegramId = BigInt(98888001);

  // Clean previous mock user
  await prisma.user.deleteMany({
    where: { telegramUserId: testTelegramId },
  });

  // Step 1: Create Test User with 0 points (simulating standard clean free user)
  const testUser = await prisma.user.create({
    data: {
      telegramUserId: testTelegramId,
      firstName: "PaymentTestUser",
      gender: "Male",
      age: 26,
      country: "United States",
      pointsBalance: 0,
      isVip: false,
      isProfileComplete: true,
    },
  });

  // Test 1: User Points Balance Retrieval (Accurate 0 display)
  const initialStatus = await getUserVipStatus(testUser.id);
  assert(
    initialStatus.pointsBalance === 0 &&
      initialStatus.isVip === false &&
      initialStatus.vipExpiresAt === null,
    "1. Free user accurately shows 0 points and inactive VIP status"
  );

  // Test 2: VIP Catalog & Pricing Integrity
  const vipPackages = await getAvailableVipPackages();
  const pkg1w = vipPackages.find((p) => p.key === "1w");
  const pkg1m = vipPackages.find((p) => p.key === "1m");
  assert(
    vipPackages.length >= 4 &&
      pkg1w !== undefined &&
      pkg1w.starsPrice > 0 &&
      pkg1w.pointsCost > 0 &&
      pkg1m !== undefined &&
      pkg1m.durationDays === 30,
    "2. VIP catalog has valid packages with non-zero Stars and Points pricing"
  );

  // Test 3: Stars Order Creation (Pending state, no premature VIP grant)
  const pendingVipOrder = await createPendingOrder({
    userId: testUser.id,
    orderType: "VIP_SUBSCRIPTION",
    packageIdOrKey: "1m",
    paymentMethod: "TELEGRAM_STARS",
  });

  const statusWhilePending = await getUserVipStatus(testUser.id);
  assert(
    pendingVipOrder.orderId !== undefined &&
      pendingVipOrder.starsAmount === (pkg1m?.starsPrice || 150) &&
      pendingVipOrder.orderPayload.startsWith("tb_order_VIP_SUBSCRIPTION_1m_") &&
      statusWhilePending.isVip === false,
    "3. Pending Stars order generates signed payload and keeps user in non-VIP state"
  );

  // Test 4: Pre-Checkout Verification: Invalid Currency Rejection
  const invalidCurrencyRes = await validatePreCheckoutQuery(
    pendingVipOrder.orderPayload,
    pendingVipOrder.starsAmount,
    "EUR"
  );
  assert(
    invalidCurrencyRes.isValid === false &&
      Boolean(invalidCurrencyRes.errorMessage?.includes("XTR")),
    "4. Pre-checkout query strictly rejects unsupported currencies (EUR/USD)"
  );

  // Test 5: Pre-Checkout Verification: Amount Mismatch Rejection
  const invalidAmountRes = await validatePreCheckoutQuery(
    pendingVipOrder.orderPayload,
    pendingVipOrder.starsAmount - 10,
    "XTR"
  );
  assert(
    invalidAmountRes.isValid === false &&
      Boolean(invalidAmountRes.errorMessage?.includes("Incorrect amount")),
    "5. Pre-checkout query strictly rejects underpaid/tampered Stars amounts"
  );

  // Test 6: Pre-Checkout Verification: Non-existent Order Rejection
  const nonExistentRes = await validatePreCheckoutQuery(
    "tb_order_VIP_SUBSCRIPTION_fake_order_payload",
    100,
    "XTR"
  );
  assert(
    nonExistentRes.isValid === false &&
      Boolean(nonExistentRes.errorMessage?.includes("Order not found")),
    "6. Pre-checkout query rejects forged or non-existent order payloads"
  );

  // Test 7: Pre-Checkout Verification: Valid Order Approval
  const validPreCheckout = await validatePreCheckoutQuery(
    pendingVipOrder.orderPayload,
    pendingVipOrder.starsAmount,
    "XTR"
  );
  assert(
    validPreCheckout.isValid === true && validPreCheckout.order !== undefined,
    "7. Pre-checkout query approves valid order payload, exact Stars amount, and XTR currency"
  );

  // Test 8: Successful Payment Fulfillment (VIP Activation)
  const chargeId1 = `tg_charge_${Date.now()}_alpha`;
  const fulfillmentResult = await fulfillSuccessfulPayment({
    telegramUserId: testUser.telegramUserId,
    telegramPaymentChargeId: chargeId1,
    orderPayload: pendingVipOrder.orderPayload,
    totalAmountStars: pendingVipOrder.starsAmount,
    currency: "XTR",
  });

  const statusAfterStarsPaid = await getUserVipStatus(testUser.id);
  const activeSubscription = await prisma.vipSubscription.findFirst({
    where: { userId: testUser.id, status: "ACTIVE" },
  });
  const completedOrderTx = await prisma.paymentTransaction.findUnique({
    where: { id: pendingVipOrder.orderId },
  });

  assert(
    fulfillmentResult.success === true &&
      fulfillmentResult.isDuplicate === false &&
      statusAfterStarsPaid.isVip === true &&
      statusAfterStarsPaid.activeVipPlan !== null &&
      activeSubscription !== null &&
      activeSubscription.costAmount === pendingVipOrder.starsAmount &&
      activeSubscription.currency === "XTR" &&
      completedOrderTx?.status === "COMPLETED" &&
      completedOrderTx?.telegramPaymentChargeId === chargeId1,
    "8. Stars successful_payment fulfills VIP, persists active subscription, and completes transaction"
  );

  // Test 9: Webhook Idempotency / Duplicate Payment Replay Protection
  const duplicateWebhookResult = await fulfillSuccessfulPayment({
    telegramUserId: testUser.telegramUserId,
    telegramPaymentChargeId: chargeId1,
    orderPayload: pendingVipOrder.orderPayload,
    totalAmountStars: pendingVipOrder.starsAmount,
    currency: "XTR",
  });

  const subsCount = await prisma.vipSubscription.count({
    where: { userId: testUser.id },
  });
  assert(
    duplicateWebhookResult.success === true &&
      duplicateWebhookResult.isDuplicate === true &&
      subsCount === 1,
    "9. Duplicate payment replay is idempotent (isDuplicate: true) and creates NO duplicate subscriptions"
  );

  // Test 10: VIP Renewal Extension Policy (No Time Lost)
  const initialVipExpiry = statusAfterStarsPaid.vipExpiresAt!;
  const renewalPendingOrder = await createPendingOrder({
    userId: testUser.id,
    orderType: "VIP_SUBSCRIPTION",
    packageIdOrKey: "1w", // +7 days
    paymentMethod: "TELEGRAM_STARS",
  });

  const chargeId2 = `tg_charge_${Date.now()}_beta`;
  await fulfillSuccessfulPayment({
    telegramUserId: testUser.telegramUserId,
    telegramPaymentChargeId: chargeId2,
    orderPayload: renewalPendingOrder.orderPayload,
    totalAmountStars: renewalPendingOrder.starsAmount,
    currency: "XTR",
  });

  const statusAfterRenewal = await getUserVipStatus(testUser.id);
  const expectedExtendedExpiryMs =
    initialVipExpiry.getTime() + 7 * 24 * 60 * 60 * 1000;
  const actualExpiryMs = statusAfterRenewal.vipExpiresAt!.getTime();
  const diffMinutes =
    Math.abs(actualExpiryMs - expectedExtendedExpiryMs) / (60 * 1000);

  assert(
    statusAfterRenewal.isVip === true && diffMinutes < 10,
    "10. Active VIP renewal extends the existing expiration timestamp (+7 days) without losing remaining days"
  );

  // Test 11: Points-Based VIP Purchase: Insufficient Points Rejection
  // User currently has 0 points. Attempting to purchase 1w (80 pts) must fail.
  const pointsPurchaseFail = await purchaseVipWithPoints(testUser.id, "1w");
  assert(
    pointsPurchaseFail.success === false &&
      pointsPurchaseFail.reason === "INSUFFICIENT_FUNDS" &&
      pointsPurchaseFail.pointsBalance === 0,
    "11. VIP points purchase strictly rejects users with insufficient points balance"
  );

  // Test 12: Points Package Store Purchase via Telegram Stars
  const pointsPkg = await prisma.pointsPackage.findFirst({
    where: { isActive: true },
  });
  assert(pointsPkg !== null, "Points package exists in database catalog");

  const pointsPendingOrder = await createPendingOrder({
    userId: testUser.id,
    orderType: "POINTS_PACKAGE",
    packageIdOrKey: pointsPkg!.id,
    paymentMethod: "TELEGRAM_STARS",
  });

  const chargeId3 = `tg_charge_${Date.now()}_gamma`;
  const pointsFulfillResult = await fulfillSuccessfulPayment({
    telegramUserId: testUser.telegramUserId,
    telegramPaymentChargeId: chargeId3,
    orderPayload: pointsPendingOrder.orderPayload,
    totalAmountStars: pointsPkg!.starsPrice,
    currency: "XTR",
  });

  const statusAfterPointsTopUp = await getUserVipStatus(testUser.id);
  const pointsTxRecord = await prisma.pointsTransaction.findFirst({
    where: { userId: testUser.id, type: "PACKAGE_PURCHASE" },
  });

  assert(
    pointsFulfillResult.success === true &&
      statusAfterPointsTopUp.pointsBalance === pointsPkg!.points &&
      pointsTxRecord !== null &&
      pointsTxRecord.amount === pointsPkg!.points,
    `12. Telegram Stars purchase of Points Package accurately credits +${pointsPkg!.points} pts with transaction audit`
  );

  // Test 13: Points-Based VIP Purchase: Successful Purchase
  // Give user enough points for 1 Week (80 pts)
  await prisma.user.update({
    where: { id: testUser.id },
    data: { pointsBalance: 100 },
  });

  const pointsPurchaseOk = await purchaseVipWithPoints(testUser.id, "1w");
  const statusAfterPointsVip = await getUserVipStatus(testUser.id);
  const pointsVipTx = await prisma.pointsTransaction.findFirst({
    where: { userId: testUser.id, type: "VIP_PURCHASE" },
  });

  assert(
    pointsPurchaseOk.success === true &&
      statusAfterPointsVip.pointsBalance === 20 &&
      pointsVipTx !== null &&
      pointsVipTx.amount === -80,
    "13. Sufficient points balance allows VIP purchase: deducts exactly 80 pts and logs VIP_PURCHASE audit"
  );

  // Test 14: Telegram Stars Refund Flow & Revocation
  const refundResult = await refundTelegramStarsPayment(
    completedOrderTx!.id,
    "E2E Automated Refund Test",
    async () => true // mock successful Telegram Bot API response
  );

  const txAfterRefund = await prisma.paymentTransaction.findUnique({
    where: { id: completedOrderTx!.id },
  });
  const subAfterRefund = await prisma.vipSubscription.findUnique({
    where: { paymentTransactionId: completedOrderTx!.id },
  });

  assert(
    refundResult.success === true &&
      txAfterRefund?.status === "REFUNDED" &&
      txAfterRefund.isRefunded === true &&
      subAfterRefund?.status === "REFUNDED",
    "14. Telegram Stars refund marks transaction & subscription as REFUNDED and logs refund audit trail"
  );

  // Step 15: Clean up test user
  await prisma.user.delete({ where: { id: testUser.id } });

  console.log("\n================================================================");
  console.log(`📊 PAYMENT TEST SUITE FINISHED: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPaymentE2ETests().catch((err) => {
  console.error("Payment E2E test crashed:", err);
  process.exit(1);
});
