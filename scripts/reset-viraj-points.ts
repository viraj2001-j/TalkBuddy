import prisma from "../lib/db";

async function main() {
  const viraj = await prisma.user.findFirst({
    where: { telegramUserId: BigInt(1856970964) },
  });

  if (!viraj) {
    console.error("Viraj not found in database!");
    return;
  }

  const currentPoints = viraj.pointsBalance;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: viraj.id },
      data: { pointsBalance: 0 },
    });

    if (currentPoints !== 0) {
      await tx.pointsTransaction.create({
        data: {
          userId: viraj.id,
          amount: -currentPoints,
          type: "ADMIN_ADJUSTMENT",
          description: "Reset balance to 0 for user testing",
        },
      });
    }
  });

  const updated = await prisma.user.findUnique({
    where: { id: viraj.id },
    select: {
      id: true,
      telegramUserId: true,
      firstName: true,
      pointsBalance: true,
      isVip: true,
      vipExpiresAt: true,
    },
  });

  console.log("Viraj points balance reset successfully:");
  console.log({
    name: updated?.firstName,
    telegramUserId: updated?.telegramUserId.toString(),
    pointsBalance: updated?.pointsBalance,
    isVip: updated?.isVip,
    vipExpiresAt: updated?.vipExpiresAt,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
