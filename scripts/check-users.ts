import prisma from "../lib/db";

async function main() {
  await prisma.user.deleteMany({ where: { telegramUserId: BigInt(999900001) } });

  const users = await prisma.user.findMany({
    include: {
      pointsTransactions: { orderBy: { createdAt: "asc" } },
      paymentTransactions: { orderBy: { createdAt: "asc" } },
      vipSubscriptions: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Found ${users.length} users in database:\n`);

  for (const user of users) {
    console.log("==========================================");
    console.log({
      id: user.id,
      telegramUserId: user.telegramUserId.toString(),
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      username: user.username,
      pointsBalance: user.pointsBalance,
      isVip: user.isVip,
      vipExpiresAt: user.vipExpiresAt,
      createdAt: user.createdAt,
    });

    console.log(`Transactions (${user.pointsTransactions.length}):`);
    for (const pt of user.pointsTransactions) {
      console.log(
        `  [${pt.createdAt.toISOString()}] ${pt.amount > 0 ? "+" : ""}${pt.amount} pts | ${pt.type} | ${pt.description}`
      );
    }
    console.log("==========================================\n");
  }

  const sessions = await prisma.chatSession.findMany({
    take: 5,
    orderBy: { startedAt: "desc" },
  });
  console.log(`Recent Chat Sessions (${sessions.length}):`);
  for (const s of sessions) {
    console.log({
      id: s.id,
      userOneId: s.userOneId,
      userTwoId: s.userTwoId,
      status: s.status,
      endedAt: s.endedAt,
      startedAt: s.startedAt,
    });
  }
}

main().catch(console.error);
