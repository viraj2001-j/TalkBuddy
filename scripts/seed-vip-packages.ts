import prisma from "../lib/db";

async function main() {
  console.log("Seeding VipPackage records in database...");

  const packages = [
    {
      key: "1w",
      name: "1 Week VIP",
      description: "7 days of VIP access including Gender Filter, Priority Queue, and Unlimited Chats",
      durationDays: 7,
      pointsCost: 80,
      starsPrice: 50,
      priceUsd: 0.99,
      badge: "Popular",
      features: "Gender Filter,Priority Matching,Unlimited Chats,Message Delete (/delete)",
      sortOrder: 1,
      isActive: true,
    },
    {
      key: "1m",
      name: "1 Month VIP",
      description: "30 days of VIP access with full premium perks & priority matching",
      durationDays: 30,
      pointsCost: 250,
      starsPrice: 150,
      priceUsd: 2.99,
      badge: "Best Value",
      features: "Gender Filter,Priority Matching,Unlimited Chats,Message Delete (/delete)",
      sortOrder: 2,
      isActive: true,
    },
    {
      key: "3m",
      name: "3 Months VIP",
      description: "90 days of VIP access — quarterly saving package",
      durationDays: 90,
      pointsCost: 700,
      starsPrice: 400,
      priceUsd: 7.99,
      badge: "Pro",
      features: "Gender Filter,Priority Matching,Unlimited Chats,Message Delete (/delete)",
      sortOrder: 3,
      isActive: true,
    },
    {
      key: "6m",
      name: "6 Months VIP",
      description: "180 days of VIP access — maximum savings & permanent priority status",
      durationDays: 180,
      pointsCost: 1250,
      starsPrice: 750,
      priceUsd: 14.99,
      badge: "VIP Whale",
      features: "Gender Filter,Priority Matching,Unlimited Chats,Message Delete (/delete)",
      sortOrder: 4,
      isActive: true,
    },
  ];

  for (const pkg of packages) {
    await prisma.vipPackage.upsert({
      where: { key: pkg.key },
      update: {
        name: pkg.name,
        description: pkg.description,
        durationDays: pkg.durationDays,
        pointsCost: pkg.pointsCost,
        starsPrice: pkg.starsPrice,
        priceUsd: pkg.priceUsd,
        badge: pkg.badge,
        features: pkg.features,
        sortOrder: pkg.sortOrder,
        isActive: pkg.isActive,
      },
      create: pkg,
    });
  }

  const all = await prisma.vipPackage.findMany({ orderBy: { sortOrder: "asc" } });
  console.log(`Seeded ${all.length} VIP packages successfully:`, all.map(p => `${p.name} (${p.pointsCost} pts / ⭐${p.starsPrice})`));
}

main().catch((err) => {
  console.error("Failed to seed VIP packages:", err);
  process.exit(1);
});
