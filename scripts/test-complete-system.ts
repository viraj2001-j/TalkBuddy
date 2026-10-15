import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import prisma from "../lib/db";
import { purchaseVipWithPoints } from "../lib/telegram/vip";
import { findAndCreateMatch } from "../lib/telegram/matching";
import { redeemPromoCode, ensureDefaultPromoCodes } from "../lib/promocodes";

async function main() {
  console.log("=====================================================");
  console.log("🧪 STARTING COMPLETE END-TO-END SYSTEM VERIFICATION");
  console.log("=====================================================");

  const tgVipUser = BigInt(9991110001);
  const tgMaleCandidate = BigInt(9991110002);
  const tgFemaleCandidate = BigInt(9991110003);

  // Clean up any old test users
  const testTgIds = [tgVipUser, tgMaleCandidate, tgFemaleCandidate];
  for (const tid of testTgIds) {
    const existing = await prisma.user.findUnique({ where: { telegramUserId: tid } });
    if (existing) {
      await prisma.chatSession.deleteMany({ where: { OR: [{ userOneId: existing.id }, { userTwoId: existing.id }] } });
      await prisma.matchingQueue.deleteMany({ where: { userId: existing.id } });
      await prisma.pointsTransaction.deleteMany({ where: { userId: existing.id } });
      await prisma.promoCodeRedemption.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }
  }

  // 1. Create a fresh user with 200 points but incomplete profile
  console.log("\n--- TEST 1: User Profile & VIP Activation ---");
  let user = await prisma.user.create({
    data: {
      telegramUserId: tgVipUser,
      firstName: "VIP_Tester",
      gender: "Male",
      age: null,
      country: null,
      isProfileComplete: false,
      isVerified: false,
      pointsBalance: 200,
      isVip: false,
    },
  });
  console.log(`Created user ${user.id} with points: ${user.pointsBalance}, isVip: ${user.isVip}, isProfileComplete: ${user.isProfileComplete}`);

  // Activate VIP 1w (costs 80 points)
  const purchase = await purchaseVipWithPoints(user.id, "1w");
  if (!purchase.success || purchase.pointsBalance !== 120) {
    throw new Error(`Failed to purchase VIP: ${JSON.stringify(purchase)}`);
  }
  console.log(`✅ VIP 1w purchased! New points balance: ${purchase.pointsBalance}`);

  // Reload user
  user = (await prisma.user.findUnique({ where: { id: user.id } }))!;
  if (!user.isVip || !user.activeVipPlan) {
    throw new Error("User should be VIP after purchase");
  }
  if (user.isProfileComplete) {
    throw new Error("Profile should still be marked INCOMPLETE until age and country are filled");
  }
  console.log("✅ User is VIP, but profile completion is properly marked INCOMPLETE pending verification!");

  // 2. Complete Profile Verification
  console.log("\n--- TEST 2: Mandatory Profile Verification ---");
  user = await prisma.user.update({
    where: { id: user.id },
    data: {
      age: 26,
      country: "Sri Lanka",
      gender: "Male",
      isProfileComplete: true,
      isVerified: true,
      verifiedAt: new Date(),
      genderFilterPreference: "Female", // VIP user sets gender filter preference to Female!
    },
  });
  if (!user.isProfileComplete || !user.isVerified || user.genderFilterPreference !== "Female") {
    throw new Error("Profile completion update failed");
  }
  console.log("✅ Mandatory verification saved! Profile complete: true, Verified: true, Filter: Female");

  // 3. Matchmaking with VIP Gender Filter
  console.log("\n--- TEST 3: VIP Gender-Filtered Matchmaking ---");
  const maleCandidate = await prisma.user.create({
    data: {
      telegramUserId: tgMaleCandidate,
      firstName: "Male_Candidate",
      gender: "Male",
      age: 24,
      country: "Sri Lanka",
      isProfileComplete: true,
      pointsBalance: 50,
    },
  });

  const femaleCandidate = await prisma.user.create({
    data: {
      telegramUserId: tgFemaleCandidate,
      firstName: "Female_Candidate",
      gender: "Female",
      age: 23,
      country: "Sri Lanka",
      isProfileComplete: true,
      pointsBalance: 50,
    },
  });

  // Both candidates join queue as WAITING
  await prisma.matchingQueue.upsert({
    where: { userId: maleCandidate.id },
    update: { status: "WAITING", partnerUserId: null, joinedAt: new Date() },
    create: { userId: maleCandidate.id, status: "WAITING" },
  });
  await prisma.matchingQueue.upsert({
    where: { userId: femaleCandidate.id },
    update: { status: "WAITING", partnerUserId: null, joinedAt: new Date() },
    create: { userId: femaleCandidate.id, status: "WAITING" },
  });
  console.log("Candidates joined queue: 1 Male, 1 Female");

  // VIP user (with gender filter = 'Female') searches for match
  console.log(`VIP user searching for match with preference: ${user.genderFilterPreference}...`);
  const matchResult = await findAndCreateMatch(user.id);

  if (!matchResult || !matchResult.partnerUserId) {
    throw new Error("Expected VIP user to find a match!");
  }

  const partnerUser = await prisma.user.findUnique({ where: { id: matchResult.partnerUserId } });
  console.log(`Matched partner found: ${partnerUser?.firstName} (Gender: ${partnerUser?.gender})`);

  if (matchResult.partnerUserId !== femaleCandidate.id) {
    throw new Error(`Expected partner to be Female candidate (${femaleCandidate.id}), but got ${matchResult.partnerUserId}`);
  }
  console.log("✅ VIP GENDER FILTER ENFORCEMENT VERIFIED! Selected female partner exclusively.");

  // Clean up queue and session
  await prisma.chatSession.deleteMany({
    where: { OR: [{ userOneId: user.id }, { userTwoId: user.id }] },
  });
  await prisma.matchingQueue.deleteMany({
    where: { userId: { in: [user.id, maleCandidate.id, femaleCandidate.id] } },
  });

  // 4. Promo Code System
  console.log("\n--- TEST 4: Promo Code System & Points Ledger ---");
  await ensureDefaultPromoCodes();

  const promoResult = await redeemPromoCode(user.id, "TALKBUDDY");
  if (!promoResult.success) {
    throw new Error(`Failed to redeem promo code TALKBUDDY: ${JSON.stringify(promoResult)}`);
  }
  console.log(`✅ Promo code redeemed! Reward: +${promoResult.pointsReward} pts. New Balance: ${promoResult.newPointsBalance}`);

  // Attempt duplicate redemption
  const dupResult = await redeemPromoCode(user.id, "TALKBUDDY");
  if (dupResult.success || dupResult.reason !== "ALREADY_REDEEMED") {
    throw new Error(`Duplicate redemption should have failed with ALREADY_REDEEMED, got: ${JSON.stringify(dupResult)}`);
  }
  console.log(`✅ Duplicate redemption correctly rejected with: "${dupResult.reason}"`);

  // 5. Cleanup Test Users
  console.log("\n--- CLEANUP ---");
  for (const tid of testTgIds) {
    const existing = await prisma.user.findUnique({ where: { telegramUserId: tid } });
    if (existing) {
      await prisma.chatSession.deleteMany({ where: { OR: [{ userOneId: existing.id }, { userTwoId: existing.id }] } });
      await prisma.matchingQueue.deleteMany({ where: { userId: existing.id } });
      await prisma.pointsTransaction.deleteMany({ where: { userId: existing.id } });
      await prisma.promoCodeRedemption.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }
  }

  console.log("\n=====================================================");
  console.log("🎉 ALL END-TO-END VERIFICATION CHECKS PASSED 100%!");
  console.log("=====================================================");
}

main()
  .catch((err) => {
    console.error("❌ E2E Test Failure:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
