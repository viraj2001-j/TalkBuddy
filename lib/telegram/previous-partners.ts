import prisma from "@/lib/db";

/**
 * Save a previous chat relationship between two users.
 *
 * This does NOT affect the live MatchingQueue.
 */
export async function savePreviousPartner(
  userOneId: string,
  userTwoId: string
) {
  if (userOneId === userTwoId) {
    return;
  }

  const [firstUserId, secondUserId] =
    userOneId < userTwoId
      ? [userOneId, userTwoId]
      : [userTwoId, userOneId];

  await prisma.previousPartner.upsert({
    where: {
      userOneId_userTwoId: {
        userOneId: firstUserId,
        userTwoId: secondUserId,
      },
    },
    update: {
      updatedAt: new Date(),
    },
    create: {
      userOneId: firstUserId,
      userTwoId: secondUserId,
    },
  });
}

/**
 * Get the previous partner of a user.
 */
export async function getPreviousPartner(userId: string) {
  return await prisma.previousPartner.findFirst({
    where: {
      OR: [
        {
          userOneId: userId,
        },
        {
          userTwoId: userId,
        },
      ],
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

/**
 * Get the actual partner user ID from a PreviousPartner record.
 */
export function getPreviousPartnerId(
  previousPartner: {
    userOneId: string;
    userTwoId: string;
  },
  userId: string
) {
  if (previousPartner.userOneId === userId) {
    return previousPartner.userTwoId;
  }

  if (previousPartner.userTwoId === userId) {
    return previousPartner.userOneId;
  }

  return null;
}