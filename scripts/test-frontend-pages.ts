async function testFrontendPages() {
  const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
  console.log("=================================================");
  console.log("       AUTOMATED FRONTEND PAGES VERIFICATION      ");
  console.log("=================================================\n");

  const routes = [
    { path: "/", name: "Public Landing Page" },
    { path: "/admin", name: "Admin Dashboard Overview" },
    { path: "/admin/payments", name: "Points & Store CRUD" },
    { path: "/admin/users", name: "User Management CRUD" },
    { path: "/admin/chats", name: "Chat Sessions & Transcripts" },
    { path: "/admin/queue", name: "Live Matching Queue" },
    { path: "/admin/vip", name: "VIP Management" },
    { path: "/admin/media", name: "Media Management" },
  ];

  let passed = 0;

  for (const route of routes) {
    const url = `${BASE_URL}${route.path}`;
    try {
      const res = await fetch(url);
      const html = await res.text();

      if (res.status === 200 && !html.includes("Internal Server Error")) {
        console.log(`✅ [200 OK] ${route.name} (${route.path}) - Size: ${html.length} bytes`);
        passed++;
      } else {
        console.error(`❌ [FAIL] ${route.name} (${route.path}) - Status: ${res.status}`);
      }
    } catch (err: any) {
      console.error(`❌ [ERROR] ${route.name} (${route.path}): ${err.message}`);
    }
  }

  console.log("\n=================================================");
  console.log(`FRONTEND VERIFICATION: ${passed}/${routes.length} ROUTES HEALTHY`);
  console.log("=================================================");

  if (passed !== routes.length) {
    process.exit(1);
  }
}

testFrontendPages();
