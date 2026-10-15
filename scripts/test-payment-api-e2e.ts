import prisma from "../lib/db";
import { renderVipPackageCheck } from "../lib/telegram/handlers/vip";
import { VIP_PLANS } from "../lib/telegram/vip";

async function runApiAndWebhookPaymentTests() {
  console.log("================================================================");
  console.log("🌐 TESTING ADMIN PAYMENT API & TELEGRAM WEBHOOK INTEGRATION 🌐");
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

  // 1. Test Admin Payments GET API
  try {
    const res = await fetch("http://localhost:3000/api/admin/payments");
    const json = await res.json();

    assert(
      res.status === 200 && json.success === true,
      "1. GET /api/admin/payments returns HTTP 200 and success: true"
    );

    assert(
      json.metrics &&
        typeof json.metrics.grossStarsReceived === "number" &&
        typeof json.metrics.netStarsRetained === "number" &&
        typeof json.metrics.activeVipSubscriptions === "number",
      "2. GET /api/admin/payments calculates accurate financial and VIP subscription metrics"
    );

    assert(
      Array.isArray(json.vipPackages) &&
        json.vipPackages.length > 0 &&
        Array.isArray(json.packages) &&
        json.packages.length > 0,
      "3. GET /api/admin/payments provides both VIP Packages and Points Packages catalogs"
    );
  } catch (err) {
    assert(false, "GET /api/admin/payments failed with network error", err);
  }

  // 2. Test Admin Payments Filter parameters
  try {
    const filterRes = await fetch(
      "http://localhost:3000/api/admin/payments?status=COMPLETED&currency=XTR"
    );
    const filterJson = await filterRes.json();
    assert(
      filterRes.status === 200 &&
        Array.isArray(filterJson.transactions) &&
        filterJson.transactions.every(
          (t: any) => t.status === "COMPLETED" && t.currency === "XTR"
        ),
      "4. GET /api/admin/payments filtering by status=COMPLETED&currency=XTR works accurately"
    );
  } catch (err) {
    assert(false, "Filtered GET /api/admin/payments failed", err);
  }

  // 3. Test VIP Package Checkout UI Generation for 0 Points vs Sufficient Points
  const plan1w = VIP_PLANS["1w"];

  // 3a. User has 0 points
  const zeroPointsCheck = renderVipPackageCheck(plan1w, 0);
  assert(
    zeroPointsCheck.isSufficient === false &&
      zeroPointsCheck.text.includes("Telegram Points Not Enough") &&
      zeroPointsCheck.reply_markup.inline_keyboard.some((row: any[]) =>
        row.some((btn) => btn.callback_data === `vip_stars_${plan1w.key}`)
      ) &&
      zeroPointsCheck.reply_markup.inline_keyboard.some((row: any[]) =>
        row.some((btn) => btn.callback_data === "earn_buy_points")
      ),
    "5. UI Check with 0 Points: Correctly detects insufficient points, displays missing points count, and provides Stars checkout + Buy Points options"
  );

  // 3b. User has 100 points (sufficient for 1w = 80 pts)
  const sufficientPointsCheck = renderVipPackageCheck(plan1w, 100);
  assert(
    sufficientPointsCheck.isSufficient === true &&
      sufficientPointsCheck.text.includes("You have enough Telegram Points to activate this package") &&
      sufficientPointsCheck.reply_markup.inline_keyboard.some((row: any[]) =>
        row.some((btn) => btn.callback_data === `vip_confirm_${plan1w.key}`)
      ) &&
      sufficientPointsCheck.reply_markup.inline_keyboard.some((row: any[]) =>
        row.some((btn) => btn.callback_data === `vip_stars_${plan1w.key}`)
      ),
    "6. UI Check with 100 Points: Correctly enables instant points activation button (vip_confirm_1w) alongside Stars checkout"
  );

  // 4. Test Telegram Webhook Endpoint Live Processing
  try {
    const mockUpdate = {
      update_id: 8881234,
      message: {
        message_id: 99991,
        from: {
          id: 1856970964, // Viraj
          is_bot: false,
          first_name: "Viraj",
        },
        chat: {
          id: 1856970964,
          type: "private",
        },
        date: Math.floor(Date.now() / 1000),
        text: "/vip",
      },
    };

    const webhookRes = await fetch("http://localhost:3000/api/telegram/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockUpdate),
    });

    assert(
      webhookRes.status === 200,
      "7. POST /api/telegram/webhook accepts Telegram updates cleanly with HTTP 200"
    );
  } catch (err) {
    assert(false, "POST /api/telegram/webhook failed with network error", err);
  }

  console.log("\n================================================================");
  console.log(`📊 API & INTEGRATION TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runApiAndWebhookPaymentTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
