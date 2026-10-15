async function testDatabaseAndReconnect() {
  const BASE_URL = "http://localhost:3001";
  console.log("=================================================");
  console.log("   DATABASE CENTER & RECONNECT API TEST SUITE    ");
  console.log("=================================================\n");

  // 1. Test Database Telemetry & Explorer API
  console.log("🔹 [TEST 1] Testing GET /api/admin/database (Telemetry)...");
  const dbRes = await fetch(`${BASE_URL}/api/admin/database`);
  const dbData = await dbRes.json();

  if (!dbData.success) throw new Error("GET /api/admin/database failed");
  console.log(`✅ Telemetry: Engine = ${dbData.telemetry?.provider}, Status = ${dbData.telemetry?.status}, DB = ${dbData.telemetry?.database}`);
  console.log(`✅ Disk Size = ${dbData.telemetry?.dbSize}, Latency = ${dbData.telemetry?.latencyMs}ms`);
  console.log(`✅ Total Tables Managed = ${dbData.telemetry?.totalTables}`);

  const tables = Object.keys(dbData.tableCounts || {});
  console.log(`✅ Detected table counts: ${tables.length} tables`);
  if (tables.length !== 14) throw new Error(`Expected 14 tables, found ${tables.length}`);

  // 2. Query Table Rows
  console.log("\n🔹 [TEST 2] Testing Table Inspection for PointsPackage...");
  const tableRes = await fetch(`${BASE_URL}/api/admin/database?table=PointsPackage&limit=10`);
  const tableData = await tableRes.json();

  if (!tableData.success || !tableData.tableData) throw new Error("Failed to fetch PointsPackage table rows");
  console.log(`✅ PointsPackage rows returned: ${tableData.tableData.rows.length} rows`);
  if (tableData.tableData.rows.length === 0) throw new Error("Expected at least 1 PointsPackage row");

  // 3. Test Database Operations (OPTIMIZE_DATABASE & CLEAN_STALE_QUEUES)
  console.log("\n🔹 [TEST 3] Testing Database Maintenance Operations...");
  const optRes = await fetch(`${BASE_URL}/api/admin/database`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "OPTIMIZE_DATABASE" }),
  });
  const optData = await optRes.json();
  if (!optData.success) throw new Error("OPTIMIZE_DATABASE operation failed");
  console.log(`✅ PostgreSQL ANALYZE executed successfully: ${optData.message}`);

  const cleanQueueRes = await fetch(`${BASE_URL}/api/admin/database`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "CLEAN_STALE_QUEUES" }),
  });
  const cleanQueueData = await cleanQueueRes.json();
  if (!cleanQueueData.success) throw new Error("CLEAN_STALE_QUEUES operation failed");
  console.log(`✅ Stale queues cleaned: ${cleanQueueData.message}`);

  // 4. Test Reconnect Requests API
  console.log("\n🔹 [TEST 4] Testing GET /api/admin/reconnect...");
  const recRes = await fetch(`${BASE_URL}/api/admin/reconnect`);
  const recData = await recRes.json();

  if (!recData.success) throw new Error("GET /api/admin/reconnect failed");
  console.log(`✅ Reconnect Requests listed: ${recData.requests.length} requests`);
  console.log(`   Pending: ${recData.stats.pending}, Accepted: ${recData.stats.accepted}, Declined: ${recData.stats.declined}, Cancelled: ${recData.stats.cancelled}`);

  // 5. Test all 13 Frontend Routes
  console.log("\n🔹 [TEST 5] Testing All 13 Admin & Web Frontend Routes...");
  const allRoutes = [
    { path: "/", name: "Public Landing" },
    { path: "/admin", name: "Overview & Analytics" },
    { path: "/admin/payments", name: "Points & Payments" },
    { path: "/admin/users", name: "User Management" },
    { path: "/admin/chats", name: "Chat Sessions & Transcripts" },
    { path: "/admin/queue", name: "Queue Monitor" },
    { path: "/admin/vip", name: "VIP & Points Ledger" },
    { path: "/admin/media", name: "Media Gallery" },
    { path: "/admin/broadcast", name: "Push Broadcast" },
    { path: "/admin/reports", name: "Reports & Moderation" },
    { path: "/admin/reconnect", name: "Reconnect Requests" },
    { path: "/admin/settings", name: "Dynamic Settings" },
    { path: "/admin/database", name: "Database Center & Explorer" },
  ];

  for (const r of allRoutes) {
    const res = await fetch(`${BASE_URL}${r.path}`);
    if (res.status !== 200) throw new Error(`Route ${r.path} failed with HTTP ${res.status}`);
    console.log(`✅ [200 OK] ${r.name.padEnd(28)} -> ${r.path}`);
  }

  console.log("\n=================================================");
  console.log("🎉 DATABASE CENTER & RECONNECT API VERIFIED 100%!");
  console.log("=================================================");
}

testDatabaseAndReconnect().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
