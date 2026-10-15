import prisma from "@/lib/db";
import { getSystemSetting } from "@/lib/system-settings";

export async function findAndCreateMatch(userId: string) {
  const isMaintenance = await getSystemSetting("MAINTENANCE_MODE");
  if (isMaintenance === "true") {
    return null;
  }

  return await prisma.$transaction(async (tx) => {
    const currentUser = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        gender: true,
        age: true,
        country: true,
        isVip: true,
        vipExpiresAt: true,
        isProfileComplete: true,
        genderFilterPreference: true,
        countryFilterPreference: true,
        minAgeFilter: true,
        maxAgeFilter: true,
      },
    });

    if (!currentUser) return null;

    const now = new Date();

    // Lazy expiration on matching request
    if (currentUser.isVip && currentUser.vipExpiresAt && currentUser.vipExpiresAt <= now) {
      await tx.user.update({
        where: { id: userId },
        data: { isVip: false, activeVipPlan: null },
      });
      currentUser.isVip = false;
    }

    const isVipEligible = Boolean(
      currentUser.isVip &&
        (!currentUser.vipExpiresAt || currentUser.vipExpiresAt > now) &&
        currentUser.isProfileComplete
    );

    // VIP criteria from current user
    const requestedGender =
      isVipEligible &&
      currentUser.genderFilterPreference &&
      currentUser.genderFilterPreference !== "ANY"
        ? currentUser.genderFilterPreference
        : null;

    const requestedCountry =
      isVipEligible &&
      currentUser.countryFilterPreference &&
      currentUser.countryFilterPreference !== "ANY"
        ? currentUser.countryFilterPreference
        : null;

    const minAge = isVipEligible ? currentUser.minAgeFilter ?? null : null;
    const maxAge = isVipEligible ? currentUser.maxAgeFilter ?? null : null;

    const currentUserGender = currentUser.gender ?? null;
    const currentUserCountry = currentUser.country ?? null;
    const currentUserAge = currentUser.age ?? null;

    // Lock the best available waiting queue row matching VIP criteria
    // Priority: VIP users in queue are matched first, followed by oldest join time
    const waitingUsers = await tx.$queryRaw<
      Array<{
        id: string;
        userId: string;
        partnerUserId: string | null;
        status: string;
      }>
    >`
      SELECT
        mq."id",
        mq."userId",
        mq."partnerUserId",
        mq."status"
      FROM "MatchingQueue" mq
      JOIN "User" u ON u."id" = mq."userId"
      WHERE
        mq."status" = 'WAITING'
        AND mq."userId" <> ${userId}
        AND u."isBanned" = false
        -- 1. Gender filter matching
        AND (${requestedGender}::text IS NULL OR u."gender" = ${requestedGender}::text)
        AND (
          u."isVip" = false
          OR (u."vipExpiresAt" IS NOT NULL AND u."vipExpiresAt" <= ${now})
          OR u."isProfileComplete" = false
          OR u."genderFilterPreference" IS NULL
          OR u."genderFilterPreference" = 'ANY'
          OR u."genderFilterPreference" = ${currentUserGender}::text
        )
        -- 2. Country filter matching
        AND (${requestedCountry}::text IS NULL OR u."country" ILIKE ${requestedCountry}::text)
        AND (
          u."isVip" = false
          OR (u."vipExpiresAt" IS NOT NULL AND u."vipExpiresAt" <= ${now})
          OR u."isProfileComplete" = false
          OR u."countryFilterPreference" IS NULL
          OR u."countryFilterPreference" = 'ANY'
          OR ${currentUserCountry}::text IS NULL
          OR u."countryFilterPreference" ILIKE ${currentUserCountry}::text
        )
        -- 3. Age filter matching
        AND (${minAge}::int IS NULL OR (u."age" IS NOT NULL AND u."age" >= ${minAge}::int))
        AND (${maxAge}::int IS NULL OR (u."age" IS NOT NULL AND u."age" <= ${maxAge}::int))
        AND (
          u."isVip" = false
          OR (u."vipExpiresAt" IS NOT NULL AND u."vipExpiresAt" <= ${now})
          OR u."isProfileComplete" = false
          OR (
            (u."minAgeFilter" IS NULL OR (${currentUserAge}::int IS NOT NULL AND ${currentUserAge}::int >= u."minAgeFilter"))
            AND
            (u."maxAgeFilter" IS NULL OR (${currentUserAge}::int IS NOT NULL AND ${currentUserAge}::int <= u."maxAgeFilter"))
          )
        )
      ORDER BY
        (CASE WHEN u."isVip" = true AND (u."vipExpiresAt" IS NULL OR u."vipExpiresAt" > ${now}) THEN 0 ELSE 1 END) ASC,
        mq."joinedAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    const partner = waitingUsers[0];

    // Nobody waiting
    if (!partner) {
      return null;
    }

    if (partner.status !== "WAITING") {
      return null;
    }

    // Connect partner
    await tx.matchingQueue.update({
      where: { id: partner.id },
      data: {
        status: "MATCHED",
        partnerUserId: userId,
      },
    });

    // Connect current user
    await tx.matchingQueue.upsert({
      where: { userId },
      update: {
        status: "MATCHED",
        partnerUserId: partner.userId,
        joinedAt: new Date(),
      },
      create: {
        userId,
        status: "MATCHED",
        partnerUserId: partner.userId,
      },
    });

    // Create active chat session
    await tx.chatSession.create({
      data: {
        userOneId: userId,
        userTwoId: partner.userId,
        status: "ACTIVE",
      },
    });

    return {
      partnerUserId: partner.userId,
    };
  });
}