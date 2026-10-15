import prisma from "@/lib/db";

export interface UserSettingUpdateData {
  firstName?: string;
  gender?: string;
  age?: number | null;
  country?: string | null;
  genderFilterPreference?: string;
  countryFilterPreference?: string;
  minAgeFilter?: number | null;
  maxAgeFilter?: number | null;
  notificationsEnabled?: boolean;
  autoTranslate?: boolean;
  preferredLanguage?: string;
}

/**
 * Saves and synchronizes user setting details across the dedicated
 * UserSetting database table and the User table in PostgreSQL.
 */
export async function saveUserSetting(
  telegramUserId: bigint | number,
  data: UserSettingUpdateData
) {
  const user = await prisma.user.findUnique({
    where: { telegramUserId: BigInt(telegramUserId) },
    select: {
      id: true,
      firstName: true,
      gender: true,
      age: true,
      country: true,
      genderFilterPreference: true,
      countryFilterPreference: true,
      minAgeFilter: true,
      maxAgeFilter: true,
      isProfileComplete: true,
      isVerified: true,
      setting: true,
    },
  });

  if (!user) return null;

  const currentGender = data.gender ?? user.gender;
  const currentAge = data.age !== undefined ? data.age : user.age;
  const currentCountry = data.country !== undefined ? data.country : user.country;

  // Age and Location are optional. As long as Gender is set and if Age is specified it's >= 18, profile is complete.
  const isProfileComplete = Boolean(
    currentGender && (currentAge == null || currentAge >= 18)
  );

  // 1. Update User table
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.gender !== undefined && { gender: data.gender }),
      ...(data.age !== undefined && { age: data.age }),
      ...(data.country !== undefined && { country: data.country }),
      ...(data.genderFilterPreference !== undefined && {
        genderFilterPreference: data.genderFilterPreference,
      }),
      ...(data.countryFilterPreference !== undefined && {
        countryFilterPreference: data.countryFilterPreference,
      }),
      ...(data.minAgeFilter !== undefined && { minAgeFilter: data.minAgeFilter }),
      ...(data.maxAgeFilter !== undefined && { maxAgeFilter: data.maxAgeFilter }),
      ...(isProfileComplete && {
        isProfileComplete: true,
        isVerified: true,
        verifiedAt: new Date(),
      }),
    },
  });

  // 2. Save directly to dedicated UserSetting database table
  const updatedSetting = await prisma.userSetting.upsert({
    where: { userId: user.id },
    update: {
      ...(data.gender !== undefined && { gender: data.gender }),
      ...(data.age !== undefined && { age: data.age }),
      ...(data.country !== undefined && { country: data.country }),
      ...(data.genderFilterPreference !== undefined && {
        genderFilterPreference: data.genderFilterPreference,
      }),
      ...(data.countryFilterPreference !== undefined && {
        countryFilterPreference: data.countryFilterPreference,
      }),
      ...(data.minAgeFilter !== undefined && { minAgeFilter: data.minAgeFilter }),
      ...(data.maxAgeFilter !== undefined && { maxAgeFilter: data.maxAgeFilter }),
      ...(data.notificationsEnabled !== undefined && {
        notificationsEnabled: data.notificationsEnabled,
      }),
      ...(data.autoTranslate !== undefined && {
        autoTranslate: data.autoTranslate,
      }),
      ...(data.preferredLanguage !== undefined && {
        preferredLanguage: data.preferredLanguage,
      }),
      isProfileComplete,
      isVerified: isProfileComplete,
      ...(isProfileComplete && { verifiedAt: new Date() }),
    },
    create: {
      userId: user.id,
      gender: currentGender || null,
      age: currentAge || null,
      country: currentCountry || null,
      genderFilterPreference: data.genderFilterPreference || user.genderFilterPreference || "ANY",
      countryFilterPreference: data.countryFilterPreference || user.countryFilterPreference || "ANY",
      minAgeFilter: data.minAgeFilter ?? user.minAgeFilter ?? null,
      maxAgeFilter: data.maxAgeFilter ?? user.maxAgeFilter ?? null,
      isProfileComplete,
      isVerified: isProfileComplete,
      verifiedAt: isProfileComplete ? new Date() : null,
      notificationsEnabled: data.notificationsEnabled ?? true,
      autoTranslate: data.autoTranslate ?? false,
      preferredLanguage: data.preferredLanguage ?? "en",
    },
  });

  return { user: updatedUser, setting: updatedSetting };
}

/**
 * Retrieves the full user settings details, auto-creating the
 * UserSetting database record if it does not already exist.
 */
export async function getUserSettings(telegramUserId: bigint | number) {
  const user = await prisma.user.findUnique({
    where: { telegramUserId: BigInt(telegramUserId) },
    include: { setting: true },
  });

  if (!user) return null;

  if (!user.setting) {
    const setting = await prisma.userSetting.create({
      data: {
        userId: user.id,
        gender: user.gender || null,
        age: user.age || null,
        country: user.country || null,
        genderFilterPreference: user.genderFilterPreference || "ANY",
        countryFilterPreference: user.countryFilterPreference || "ANY",
        minAgeFilter: user.minAgeFilter || null,
        maxAgeFilter: user.maxAgeFilter || null,
        isProfileComplete: user.isProfileComplete,
        isVerified: user.isVerified,
        verifiedAt: user.verifiedAt,
        notificationsEnabled: true,
        autoTranslate: false,
        preferredLanguage: user.languageCode || "en",
      },
    });

    return { ...user, setting };
  }

  return user;
}

