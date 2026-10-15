import prisma from "../lib/db";

async function main() {
  console.log("🌱 Seeding default Points Packages...");

  const existingPackages = await prisma.pointsPackage.count();
  if (existingPackages === 0) {
    await prisma.pointsPackage.createMany({
      data: [
        {
          name: "Starter Pack",
          description: "Get started with 100 points for saves & reconnects",
          points: 100,
          priceUsd: 0.99,
          starsPrice: 50,
          badge: "Starter",
          isActive: true,
        },
        {
          name: "Chatter Pack",
          description: "350 points — perfect for active chatters",
          points: 350,
          priceUsd: 2.99,
          starsPrice: 150,
          badge: "Popular",
          isActive: true,
        },
        {
          name: "VIP Power Pack",
          description: "1,000 points — unlock VIP for months and save contacts",
          points: 1000,
          priceUsd: 7.99,
          starsPrice: 400,
          badge: "Best Value",
          isActive: true,
        },
        {
          name: "Elite Whale Pack",
          description: "2,500 points — maximum points with huge bonus",
          points: 2500,
          priceUsd: 17.99,
          starsPrice: 900,
          badge: "Ultimate",
          isActive: true,
        },
      ],
    });
    console.log("✅ Seeded 4 default Points Packages!");
  } else {
    console.log(`ℹ️ Already found ${existingPackages} packages.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
