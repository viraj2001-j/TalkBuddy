import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import prisma from "../lib/db";
import { VIP_PLANS, purchaseVipWithPoints } from "../lib/telegram/vip";
import {
  renderVipPackageCheck,
  renderVipActivatedMessage,
} from "../lib/telegram/handlers/vip";

async function main() {
  console.log("🧪 Testing VIP Package Activation Flow with Telegram Points Check...");

  // 1. Test renderVipPackageCheck when user has insufficient points
  const plan1w = VIP_PLANS["1w"]; // costs 80 points
  const checkLowPoints = renderVipPackageCheck(plan1w, 25);

  if (checkLowPoints.isSufficient !== false) {
    throw new Error("Expected isSufficient to be false for 25 points when cost is 80");
  }
  if (!checkLowPoints.text.includes("Telegram Points Not Enough!")) {
    throw new Error("Expected insufficient points text");
  }
  if (!checkLowPoints.text.includes("25 Points") || !checkLowPoints.text.includes("80 Telegram Points")) {
    throw new Error("Expected points to be shown in text");
  }
  console.log("✅ Insufficient points check correctly displays points shortage & buy buttons!");

  // 2. Test renderVipPackageCheck when user has suitable amount
  const checkHighPoints = renderVipPackageCheck(plan1w, 100);
  if (checkHighPoints.isSufficient !== true) {
    throw new Error("Expected isSufficient to be true for 100 points when cost is 80");
  }
  if (!checkHighPoints.text.includes("You have enough Telegram Points to activate this package!")) {
    throw new Error("Expected sufficient points text");
  }
  if (!checkHighPoints.text.includes("100 Points") || !checkHighPoints.text.includes("80 Telegram Points")) {
    throw new Error("Expected user's points and cost to be clearly displayed");
  }
  console.log("✅ Sufficient points check correctly displays user points & activation confirmation button!");

  // 3. Test VIP purchase execution
  const testTgId = BigInt(998877665544);
  const user = await prisma.user.upsert({
    where: { telegramUserId: testTgId },
    create: {
      telegramUserId: testTgId,
      firstName: "VipTestUser",
      gender: "Male",
      pointsBalance: 100,
    },
    update: {
      pointsBalance: 100,
      isVip: false,
      vipExpiresAt: null,
      activeVipPlan: null,
    },
  });

  // Try buying plan that user cannot afford (6m costs 1250 points)
  const failResult = await purchaseVipWithPoints(user.id, "6m");
  if (failResult.success !== false || failResult.reason !== "INSUFFICIENT_FUNDS") {
    throw new Error("Expected purchaseVipWithPoints to reject insufficient funds");
  }
  console.log("✅ purchaseVipWithPoints properly rejects insufficient funds!");

  // Buy plan that user can afford (1w costs 80 points)
  const successResult = await purchaseVipWithPoints(user.id, "1w");
  if (!successResult.success) {
    throw new Error(`Expected purchaseVipWithPoints to succeed: ${JSON.stringify(successResult)}`);
  }
  if (successResult.pointsBalance !== 20) {
    throw new Error(`Expected pointsBalance 20, got ${successResult.pointsBalance}`);
  }

  const activatedCard = renderVipActivatedMessage(successResult);
  if (!activatedCard.text.includes("VIP Membership Activated!")) {
    throw new Error("Expected success message to celebrate activation");
  }
  console.log("✅ purchaseVipWithPoints and renderVipActivatedMessage work end-to-end!");

  // Cleanup test user
  await prisma.pointsTransaction.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log("🎉 ALL VIP ACTIVATION & TELEGRAM POINTS TESTS PASSED!");
}

main()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
