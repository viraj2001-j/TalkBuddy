import prisma from "../lib/db";
import {
  claimDailyReward,
  processReferral,
  spendPoints,
  addPoints,
  processPackagePayment,
} from "../lib/telegram/points";
import { checkUserBan } from "../lib/telegram/security";
import { findAndCreateMatch } from "../lib/telegram/matching";

async function runSecurityTests() {
  console.log("=================================================");
  console.log("   TALKBUDDY SECURITY & INTEGRITY TEST SUITE     ");
  console.log("=================================================\n");

  const testSuffix = Math.random().toString(36).substring(2, 7);
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalCount++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   Details: ${detail}`);
    }
  }

  // Setup test users
  const userA = await prisma.user.create({
    data: {
      telegramUserId: BigInt(9900000000 + Math.floor(Math.random() * 9000000)),
      username: `sec_a_${testSuffix}`,
      firstName: `SecA_${testSuffix}`,
      gender: "MALE",
      pointsBalance: 100,
      referralCode: `REF_A_${testSuffix}`,
    },
  });

  const userB = await prisma.user.create({
    data: {
      telegramUserId: BigInt(9910000000 + Math.floor(Math.random() * 9000000)),
      username: `sec_b_${testSuffix}`,
      firstName: `SecB_${testSuffix}`,
      gender: "FEMALE",
      pointsBalance: 50,
      referralCode: `REF_B_${testSuffix}`,
    },
  });

  const userC = await prisma.user.create({
    data: {
      telegramUserId: BigInt(9920000000 + Math.floor(Math.random() * 9000000)),
      username: `sec_c_${testSuffix}`,
      firstName: `SecC_${testSuffix}`,
      gender: "MALE",
      pointsBalance: 10,
      isBanned: true,
      banReason: "Spamming offensive media",
    },
  });

  try {
    // TEST 1: Negative / Zero Point Injection Prevention
    let addNegativeBlocked = false;
    try {
      await addPoints(userA.id, -50, "ADMIN_ADJUSTMENT");
    } catch {
      addNegativeBlocked = true;
    }
    assert(addNegativeBlocked, "Prevent negative point injection in addPoints");

    let spendNegativeBlocked = false;
    try {
      await spendPoints(userA.id, 0, "SAVE_PARTNER");
    } catch {
      spendNegativeBlocked = true;
    }
    assert(spendNegativeBlocked, "Prevent zero/negative point injection in spendPoints");

    // TEST 2: Overdraft / Insufficient Funds Protection
    const overspendResult = await spendPoints(userA.id, 999999, "VIP_PURCHASE");
    assert(
      overspendResult.success === false && overspendResult.reason === "INSUFFICIENT_FUNDS",
      "Prevent spending more points than available balance (no overdraft)",
      `Expected INSUFFICIENT_FUNDS, got: ${JSON.stringify(overspendResult)}`
    );

    // Verify balance was unaffected
    const checkUserA = await prisma.user.findUnique({ where: { id: userA.id } });
    assert(checkUserA?.pointsBalance === 100, "User balance unchanged after failed spend attempt");

    // TEST 3: Concurrency Race Condition on Daily Rewards
    console.log("\n--- Testing High-Concurrency Race Conditions ---");
    // Fire 10 concurrent daily reward claims for User A
    const concurrencyPromises = Array.from({ length: 10 }).map(() =>
      claimDailyReward(userA.id)
    );
    const results = await Promise.all(concurrencyPromises);

    const successfulClaims = results.filter((r) => r.success === true);
    const cooldownRejected = results.filter((r) => r.success === false && r.reason === "COOLDOWN_ACTIVE");

    assert(
      successfulClaims.length === 1,
      "Exactly 1 daily reward claim succeeds under 10 concurrent requests",
      `Successful claims: ${successfulClaims.length}`
    );
    assert(
      cooldownRejected.length === 9,
      "Exactly 9 concurrent claims rejected with COOLDOWN_ACTIVE",
      `Rejected claims: ${cooldownRejected.length}`
    );

    const postDailyUserA = await prisma.user.findUnique({ where: { id: userA.id } });
    assert(
      postDailyUserA?.pointsBalance === 125,
      "Daily reward credited exactly 25 points once (100 + 25 = 125)",
      `Expected 125, got: ${postDailyUserA?.pointsBalance}`
    );

    // TEST 4: Referral System Security & Double-Claim Prevention
    console.log("\n--- Testing Referral Abuse Prevention ---");
    // Self-referral attempt
    const selfRefResult = await processReferral(userA.id, `REF_A_${testSuffix}`);
    assert(
      selfRefResult.success === false,
      "Prevent user from referring themselves",
      `Expected failure, got: ${JSON.stringify(selfRefResult)}`
    );

    // Invalid referral code attempt
    const invalidRefResult = await processReferral(userB.id, "NON_EXISTENT_CODE_XYZ");
    assert(
      invalidRefResult.success === false && invalidRefResult.reason === "REFERRER_NOT_FOUND",
      "Reject invalid referral codes"
    );

    // High-concurrency referral claim (5 parallel requests for user B)
    const refConcurrencyPromises = Array.from({ length: 5 }).map(() =>
      processReferral(userB.id, `REF_A_${testSuffix}`)
    );
    const refResults = await Promise.all(refConcurrencyPromises);
    const successfulRefs = refResults.filter((r) => r.success === true);
    const alreadyReferred = refResults.filter((r) => r.success === false && r.reason === "ALREADY_REFERRED");

    assert(
      successfulRefs.length === 1,
      "Exactly 1 referral claim succeeds for a new user under concurrent load",
      `Successful: ${successfulRefs.length}`
    );
    assert(
      alreadyReferred.length === 4,
      "Remaining concurrent referral attempts rejected with ALREADY_REFERRED",
      `Rejected: ${alreadyReferred.length}`
    );

    // Check balances
    const postRefUserA = await prisma.user.findUnique({ where: { id: userA.id } });
    const postRefUserB = await prisma.user.findUnique({ where: { id: userB.id } });
    assert(
      postRefUserA?.pointsBalance === 175,
      "Referrer credited exactly +50 bonus points (125 + 50 = 175)",
      `Expected 175, got: ${postRefUserA?.pointsBalance}`
    );
    assert(
      postRefUserB?.pointsBalance === 75,
      "Referee credited exactly +25 welcome points (50 + 25 = 75)",
      `Expected 75, got: ${postRefUserB?.pointsBalance}`
    );

    // TEST 5: Ban Enforcement & Queue Isolation
    console.log("\n--- Testing Ban Enforcement & Security Guards ---");
    const banCheck = await checkUserBan(Number(userC.telegramUserId));
    assert(
      banCheck.isBanned === true && banCheck.reason === "Spamming offensive media",
      "checkUserBan identifies banned user with correct reason"
    );

    // Banned user in matching queue
    await prisma.matchingQueue.create({
      data: {
        userId: userC.id,
        status: "WAITING",
      },
    });

    // Unbanned user in matching queue
    await prisma.matchingQueue.create({
      data: {
        userId: userA.id,
        status: "WAITING",
      },
    });

    const matchAttempt = await findAndCreateMatch(userA.id);
    assert(
      matchAttempt === null,
      "Matching engine strictly isolates banned users (no match formed with banned user)",
      `Expected null, got: ${JSON.stringify(matchAttempt)}`
    );

    // TEST 6: Payment Package Integrity
    console.log("\n--- Testing Payment Package Transactions ---");
    const packages = await prisma.pointsPackage.findMany({ where: { isActive: true } });
    assert(packages.length > 0, "Active points packages exist in the store");

    if (packages.length > 0) {
      const pkg = packages[0];
      const initialBalance = postRefUserA?.pointsBalance ?? 0;
      const paymentResult = await processPackagePayment(userA.id, pkg.id, "TEST_PROVIDER");

      assert(
        paymentResult.success === true,
        `Successful payment processing for package: ${pkg.name}`
      );

      const checkPaymentUser = await prisma.user.findUnique({ where: { id: userA.id } });
      assert(
        checkPaymentUser?.pointsBalance === initialBalance + pkg.points,
        `User balance credited by exact package points (+${pkg.points})`,
        `Expected ${initialBalance + pkg.points}, got ${checkPaymentUser?.pointsBalance}`
      );

      if (paymentResult.success) {
        const transaction = await prisma.paymentTransaction.findUnique({
          where: { id: paymentResult.paymentId },
        });
        assert(
          transaction?.status === "COMPLETED" && transaction?.userId === userA.id,
          "Payment audit transaction logged as COMPLETED"
        );
      }
    }

    // Invalid package purchase attempt
    const invalidPkgResult = await processPackagePayment(userA.id, "invalid_non_existent_pkg");
    assert(
      invalidPkgResult.success === false && invalidPkgResult.reason === "PACKAGE_NOT_FOUND",
      "Reject payment attempts for non-existent package IDs"
    );

  } finally {
    // Cleanup test data
    console.log("\n--- Cleaning up test records ---");
    await prisma.paymentTransaction.deleteMany({
      where: { userId: { in: [userA.id, userB.id, userC.id] } },
    });
    await prisma.pointsTransaction.deleteMany({
      where: { userId: { in: [userA.id, userB.id, userC.id] } },
    });
    await prisma.matchingQueue.deleteMany({
      where: { userId: { in: [userA.id, userB.id, userC.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id, userC.id] } },
    });
    console.log("Cleaned up test users successfully.");
  }

  console.log("\n=================================================");
  console.log(`   SECURITY TEST RESULTS: ${passedCount}/${totalCount} PASSED   `);
  console.log("=================================================");

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runSecurityTests()
  .catch((e) => {
    console.error("Unhandled error in security tests:", e);
    process.exit(1);
  });
