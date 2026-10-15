import prisma from "@/lib/db";

export const SAVE_PARTNER_NICKNAME_MIN_LENGTH = 3;
export const SAVE_PARTNER_NICKNAME_MAX_LENGTH = 15;

export type SavePartnerState =
  | "NONE"
  | "WAITING_FOR_NICKNAME";

export async function getSavePartnerState(
  userId: string
): Promise<SavePartnerState> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { savePartnerState: true },
  });

  return user?.savePartnerState ?? "NONE";
}

export async function setSavePartnerState(
  userId: string,
  state: SavePartnerState
) {
  await prisma.user.update({
    where: { id: userId },
    data: { savePartnerState: state },
  });
}

export async function clearSavePartnerState(
  userId: string
) {
  await prisma.user.update({
    where: { id: userId },
    data: { savePartnerState: "NONE" },
  });
}

export function validatePartnerNickname(
  nickname: string
) {
  const trimmed = nickname.trim();

  if (
    trimmed.length <
      SAVE_PARTNER_NICKNAME_MIN_LENGTH ||
    trimmed.length >
      SAVE_PARTNER_NICKNAME_MAX_LENGTH
  ) {
    return {
      valid: false,
      message:
        "Nickname must be between 3 and 15 characters.",
    };
  }

  if (!/^[A-Za-z0-9]+$/.test(trimmed)) {
    return {
      valid: false,
      message:
        "Nickname can contain only letters and numbers.",
    };
  }

  return {
    valid: true,
    nickname: trimmed,
  };
}

/**
 * Save a nickname for a previous partner.
 *
 * The partner must already exist in PreviousPartner.
 */
export async function savePartnerNickname(
  userId: string,
  partnerId: string,
  nickname: string
) {
  const validation =
    validatePartnerNickname(nickname);

  if (!validation.valid) {
    return {
      success: false,
      reason: "INVALID_NICKNAME" as const,
      message: validation.message,
    };
  }

  const previousPartner =
    await prisma.previousPartner.findFirst({
      where: {
        OR: [
          {
            userOneId: userId,
            userTwoId: partnerId,
          },
          {
            userOneId: partnerId,
            userTwoId: userId,
          },
        ],
      },
    });

  if (!previousPartner) {
    return {
      success: false,
      reason: "NOT_PREVIOUS_PARTNER" as const,
      message:
        "This user is not in your previous partners.",
    };
  }

  return {
    success: true,
    nickname: validation.nickname,
    previousPartnerId: previousPartner.id,
  };
}