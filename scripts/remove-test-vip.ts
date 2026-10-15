import prisma from "../lib/db";

async function main() {
  const allPackages = await prisma.vipPackage.findMany();
  console.log("Current DB VIP Packages:", allPackages.map((p) => ({ id: p.id, key: p.key, name: p.name })));

  const testPkg = await prisma.vipPackage.findUnique({
    where: { key: "test" },
  });

  if (testPkg) {
    console.log("Found 'test' VIP package in DB. Deleting or deactivating...");
    // Check if any subscriptions or transactions use it
    const subCount = await prisma.vipSubscription.count({ where: { packageId: testPkg.id } });
    const txCount = await prisma.paymentTransaction.count({ where: { vipPackageId: testPkg.id } });
    console.log(`Associated records: ${subCount} subscriptions, ${txCount} transactions`);

    if (subCount === 0 && txCount === 0) {
      await prisma.vipPackage.delete({ where: { key: "test" } });
      console.log("Deleted 'test' VIP package from DB.");
    } else {
      await prisma.vipPackage.update({
        where: { key: "test" },
        data: { isActive: false },
      });
      console.log("Deactivated 'test' VIP package (isActive: false) to preserve referential integrity.");
    }
  } else {
    console.log("No 'test' VIP package in DB.");
  }

  const remaining = await prisma.vipPackage.findMany({ where: { isActive: true } });
  console.log("Active DB VIP Packages:", remaining.map((p) => ({ key: p.key, name: p.name })));
}

main().catch(console.error);
