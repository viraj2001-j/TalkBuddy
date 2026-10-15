import prisma from "../lib/db";
import { getMainMenuKeyboard, getVipKeyboard } from "../lib/telegram/menu";
import { getUserVipStatus, createPendingOrder, fulfillSuccessfulPayment } from "../lib/telegram/vip";
import { saveUserSetting } from "../lib/telegram/user-settings";
import { renderVipActivatedMessage } from "../lib/telegram/handlers/vip";
import { findAndCreateMatch } from "../lib/telegram/matching";

async function runVipOnboardingAndFilterTests() {
  console.log("================================================================");
  console.log("🎯 TESTING VIP PROFILE ONBOARDING & GENDER FILTER WORKFLOW 🎯");
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

  const testTgId = BigInt(98777001);
  const partnerTgId = BigInt(98777002);

  // Clean previous mock users
  await prisma.user.deleteMany({
    where: { telegramUserId: { in: [testTgId, partnerTgId] } },
  });

  // Step 1: Create a newly registered user who doesn't have age or country set yet
  const user = await prisma.user.create({
    data: {
      telegramUserId: testTgId,
      firstName: "TestVipAlex",
      gender: "Male",
      isVip: false,
      pointsBalance: 0,
      isProfileComplete: false,
    },
  });

  // Test 1: Main menu for non-VIP does not show VIP Gender Filter button
  const nonVipMenu = getMainMenuKeyboard(false);
  const hasFilterBtnNonVip = nonVipMenu.inline_keyboard.some((row) =>
    row.some((b) => b.callback_data === "vip_filter_select")
  );
  assert(
    hasFilterBtnNonVip === false,
    "1. Free (non-VIP) user main menu does NOT show the VIP Gender Filter button"
  );

  // Test 2: Main menu for VIP user prominently displays VIP Gender Filter button
  const vipMenu = getMainMenuKeyboard(true);
  const hasFilterBtnVip = vipMenu.inline_keyboard.some((row) =>
    row.some((b) => b.callback_data === "vip_filter_select")
  );
  assert(
    hasFilterBtnVip === true,
    "2. VIP user main menu prominently displays the '🎯 VIP Gender Filter' button"
  );

  // Test 3: getVipKeyboard for VIP user displays "🎯 Choose Gender Filter"
  const vipKeyboard = getVipKeyboard(true);
  const hasChooseFilterBtn = vipKeyboard.inline_keyboard.some((row) =>
    row.some((b) => b.callback_data === "vip_filter_select")
  );
  assert(
    hasChooseFilterBtn === true,
    "3. /vip menu keyboard for active VIP displays '🎯 Choose Gender Filter' button"
  );

  // Test 4: Activate VIP via Stars payment
  const pendingOrder = await createPendingOrder({
    userId: user.id,
    orderType: "VIP_SUBSCRIPTION",
    packageIdOrKey: "1w",
    paymentMethod: "TELEGRAM_STARS",
  });

  const chargeId = `tg_charge_${Date.now()}_filter_test`;
  const paymentRes = await fulfillSuccessfulPayment({
    telegramUserId: testTgId,
    telegramPaymentChargeId: chargeId,
    orderPayload: pendingOrder.orderPayload,
    totalAmountStars: pendingOrder.starsAmount,
    currency: "XTR",
  });

  const statusAfterPayment = await getUserVipStatus(user.id);
  assert(
    paymentRes.success === true && statusAfterPayment.isVip === true,
    "4. VIP package activated successfully via Telegram payment gateway"
  );

  // Test 5: Incomplete profile after VIP activation generates "Set Profile & Gender Filter" button
  const activatedMessage = renderVipActivatedMessage(
    {
      plan: {
        key: "1w",
        label: "1 Week VIP",
        durationDays: 7,
        pointsCost: 80,
        starsPrice: 50,
        description: "1 Week VIP",
      },
      pointsBalance: 0,
      vipExpiresAt: statusAfterPayment.vipExpiresAt,
    },
    false // profile incomplete
  );

  const hasOnboardBtn = activatedMessage.reply_markup.inline_keyboard.some((row) =>
    row.some((b) => b.callback_data === "vip_onboard_start")
  );
  assert(
    hasOnboardBtn === true &&
      activatedMessage.text.includes("Setup Your Profile & Gender Filter"),
    "5. VIP activation response presents prominent '🎯 Set Profile & Gender Filter' button"
  );

  // Test 6: Step 1 (Name) & Step 2 (Optional Age) saving
  await saveUserSetting(testTgId, { age: 24 });
  const userAfterAge = await prisma.user.findUnique({ where: { id: user.id } });
  assert(
    userAfterAge?.age === 24,
    "6. Step 2 (Age): User age saved accurately (age: 24)"
  );

  // Test 7: Step 3 (Gender) & Step 4 (Optional Location) saving
  await saveUserSetting(testTgId, {
    gender: "Male",
    country: "Sri Lanka",
  });
  const userAfterProfile = await prisma.user.findUnique({ where: { id: user.id } });
  assert(
    userAfterProfile?.gender === "Male" &&
      userAfterProfile?.country === "Sri Lanka" &&
      userAfterProfile?.isProfileComplete === true,
    "7. Step 3 (Gender) & Step 4 (Location): Gender and Country saved, profile marked complete"
  );

  // Test 8: Setting VIP Gender Filter to "Female"
  await saveUserSetting(testTgId, {
    genderFilterPreference: "Female",
  });

  const userAfterFilter = await prisma.user.findUnique({ where: { id: user.id } });
  assert(
    userAfterFilter?.genderFilterPreference === "Female",
    "8. Step 5 (Gender Filter): User preferred partner gender set to 'Female' in PostgreSQL"
  );

  // Test 9: Matching queue strictly respects the VIP Gender Filter
  // Create Female partner waiting in queue
  const femalePartner = await prisma.user.create({
    data: {
      telegramUserId: partnerTgId,
      firstName: "SarahFemale",
      gender: "Female",
      isProfileComplete: true,
      age: 23,
      country: "Sri Lanka",
    },
  });

  await prisma.matchingQueue.upsert({
    where: { userId: femalePartner.id },
    update: { status: "WAITING", partnerUserId: null, joinedAt: new Date() },
    create: { userId: femalePartner.id, status: "WAITING" },
  });

  const matchResult = await findAndCreateMatch(user.id);
  assert(
    matchResult !== null && matchResult.partnerUserId === femalePartner.id,
    "9. Live matching engine pairs user with Female partner matching the VIP Gender Filter"
  );

  // Clean up test records
  await prisma.chatSession.deleteMany({
    where: {
      OR: [
        { userOneId: user.id, userTwoId: femalePartner.id },
        { userOneId: femalePartner.id, userTwoId: user.id },
      ],
    },
  });
  await prisma.matchingQueue.deleteMany({
    where: { userId: { in: [user.id, femalePartner.id] } },
  });
  await prisma.user.deleteMany({
    where: { telegramUserId: { in: [testTgId, partnerTgId] } },
  });

  console.log("\n================================================================");
  console.log(`📊 ONBOARDING & FILTER TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runVipOnboardingAndFilterTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
