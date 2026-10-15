// // import prisma from "@/lib/db";

// // export async function createReconnectRequest(
// //   senderId: string,
// //   receiverId: string
// // ) {
// //   if (senderId === receiverId) {
// //     return null;
// //   }

// //   // Make sure they are actually previous partners.
// //   const previousPartner = await prisma.previousPartner.findFirst({
// //     where: {
// //       OR: [
// //         {
// //           userOneId: senderId,
// //           userTwoId: receiverId,
// //         },
// //         {
// //           userOneId: receiverId,
// //           userTwoId: senderId,
// //         },
// //       ],
// //     },
// //   });

// //   if (!previousPartner) {
// //     return null;
// //   }

// //   // Don't create another request if one is already pending.
// //   const existingRequest = await prisma.reconnectRequest.findFirst({
// //     where: {
// //       OR: [
// //         {
// //           senderId,
// //           receiverId,
// //         },
// //         {
// //           senderId: receiverId,
// //           receiverId: senderId,
// //         },
// //       ],
// //       status: "PENDING",
// //     },
// //   });

// //   if (existingRequest) {
// //     return existingRequest;
// //   }

// //   return await prisma.reconnectRequest.create({
// //     data: {
// //       senderId,
// //       receiverId,
// //       status: "PENDING",
// //     },
// //   });
// // }

// // export async function getPendingReconnectRequestForUser(
// //   userId: string
// // ) {
// //   return await prisma.reconnectRequest.findFirst({
// //     where: {
// //       receiverId: userId,
// //       status: "PENDING",
// //     },
// //     orderBy: {
// //       createdAt: "desc",
// //     },
// //   });
// // }

// // export async function getReconnectRequestById(
// //   requestId: string
// // ) {
// //   return await prisma.reconnectRequest.findUnique({
// //     where: {
// //       id: requestId,
// //     },
// //   });
// // }



// // export async function acceptReconnectRequest(
// //   requestId: string,
// //   receiverId: string
// // ) {
// //   return await prisma.$transaction(async (tx) => {
// //     const request = await tx.reconnectRequest.findUnique({
// //       where: {
// //         id: requestId,
// //       },
// //     });

// //     if (!request) {
// //       return null;
// //     }

// //     // Receiver must be the actual receiver.
// //     if (request.receiverId !== receiverId) {
// //       return null;
// //     }

// //     // Only PENDING requests can be accepted.
// //     if (request.status !== "PENDING") {
// //       return null;
// //     }

// //     // Make sure both users are still previous partners.
// //     const previousPartner = await tx.previousPartner.findFirst({
// //       where: {
// //         OR: [
// //           {
// //             userOneId: request.senderId,
// //             userTwoId: request.receiverId,
// //           },
// //           {
// //             userOneId: request.receiverId,
// //             userTwoId: request.senderId,
// //           },
// //         ],
// //       },
// //     });

// //     if (!previousPartner) {
// //       return null;
// //     }

// //     // Neither user can already have an active chat.
// //     const activeSessions = await tx.chatSession.findMany({
// //       where: {
// //         status: "ACTIVE",
// //         OR: [
// //           {
// //             userOneId: request.senderId,
// //           },
// //           {
// //             userTwoId: request.senderId,
// //           },
// //           {
// //             userOneId: request.receiverId,
// //           },
// //           {
// //             userTwoId: request.receiverId,
// //           },
// //         ],
// //       },
// //       select: {
// //         id: true,
// //       },
// //     });

// //     if (activeSessions.length > 0) {
// //       return null;
// //     }

// //     // ========================================
// //     // CHECK LIVE MATCHED STATE
// //     // ========================================
// //     //
// //     // WAITING is allowed here because the sender
// //     // can send a reconnect request while waiting.
// //     //
// //     // MATCHED is NOT allowed because that means
// //     // the user already has another active chat.
// //     //

// //     const matchedQueueEntries =
// //       await tx.matchingQueue.findMany({
// //         where: {
// //           userId: {
// //             in: [
// //               request.senderId,
// //               request.receiverId,
// //             ],
// //           },
// //           status: "MATCHED",
// //         },
// //         select: {
// //           userId: true,
// //           status: true,
// //           partnerUserId: true,
// //         },
// //       });

// //     if (matchedQueueEntries.length > 0) {
// //       return null;
// //     }

// //     // ========================================
// //     // ACCEPT REQUEST
// //     // ========================================

// //     const acceptedRequest =
// //       await tx.reconnectRequest.update({
// //         where: {
// //           id: request.id,
// //         },
// //         data: {
// //           status: "ACCEPTED",
// //         },
// //       });

// //     // ========================================
// //     // CREATE NORMAL ACTIVE CHAT
// //     // ========================================

// //     const chatSession = await tx.chatSession.create({
// //       data: {
// //         userOneId: request.senderId,
// //         userTwoId: request.receiverId,
// //         status: "ACTIVE",
// //       },
// //     });

// //     // ========================================
// //     // CONNECT SENDER
// //     // ========================================

// //     await tx.matchingQueue.upsert({
// //       where: {
// //         userId: request.senderId,
// //       },
// //       update: {
// //         status: "MATCHED",
// //         partnerUserId: request.receiverId,
// //         joinedAt: new Date(),
// //       },
// //       create: {
// //         userId: request.senderId,
// //         status: "MATCHED",
// //         partnerUserId: request.receiverId,
// //       },
// //     });

// //     // ========================================
// //     // CONNECT RECEIVER
// //     // ========================================

// //     await tx.matchingQueue.upsert({
// //       where: {
// //         userId: request.receiverId,
// //       },
// //       update: {
// //         status: "MATCHED",
// //         partnerUserId: request.senderId,
// //         joinedAt: new Date(),
// //       },
// //       create: {
// //         userId: request.receiverId,
// //         status: "MATCHED",
// //         partnerUserId: request.senderId,
// //       },
// //     });

// //     return {
// //       request: acceptedRequest,
// //       chatSession,
// //       senderId: request.senderId,
// //       receiverId: request.receiverId,
// //     };
// //   });
// // }

// // // export async function acceptReconnectRequest(
// // //   requestId: string,
// // //   receiverId: string
// // // ) {
// // //   return await prisma.$transaction(async (tx) => {
// // //     const request = await tx.reconnectRequest.findUnique({
// // //       where: {
// // //         id: requestId,
// // //       },
// // //     });

// // //     if (!request) {
// // //       return null;
// // //     }

// // //     // Receiver must be the actual receiver.
// // //     if (request.receiverId !== receiverId) {
// // //       return null;
// // //     }

// // //     // A cancelled/declined/accepted request can NEVER be accepted again.
// // //     if (request.status !== "PENDING") {
// // //       return null;
// // //     }

// // //     // Make sure both users are still previous partners.
// // //     const previousPartner = await tx.previousPartner.findFirst({
// // //       where: {
// // //         OR: [
// // //           {
// // //             userOneId: request.senderId,
// // //             userTwoId: request.receiverId,
// // //           },
// // //           {
// // //             userOneId: request.receiverId,
// // //             userTwoId: request.senderId,
// // //           },
// // //         ],
// // //       },
// // //     });

// // //     if (!previousPartner) {
// // //       return null;
// // //     }

// // //     // Both users must be free before reconnecting.
// // //     const activeSessions = await tx.chatSession.findMany({
// // //       where: {
// // //         status: "ACTIVE",
// // //         OR: [
// // //           {
// // //             userOneId: request.senderId,
// // //           },
// // //           {
// // //             userTwoId: request.senderId,
// // //           },
// // //           {
// // //             userOneId: request.receiverId,
// // //           },
// // //           {
// // //             userTwoId: request.receiverId,
// // //           },
// // //         ],
// // //       },
// // //       select: {
// // //         id: true,
// // //       },
// // //     });

// // //     if (activeSessions.length > 0) {
// // //       return null;
// // //     }

// // //     // Both users must not already be in the matching queue.
// // //     const busyQueueEntries = await tx.matchingQueue.findMany({
// // //       where: {
// // //         userId: {
// // //           in: [request.senderId, request.receiverId],
// // //         },
// // //         status: {
// // //           in: ["WAITING", "MATCHED"],
// // //         },
// // //       },
// // //       select: {
// // //         userId: true,
// // //         status: true,
// // //       },
// // //     });

// // //     if (busyQueueEntries.length > 0) {
// // //       return null;
// // //     }

// // //     // Mark request accepted.
// // //     const acceptedRequest = await tx.reconnectRequest.update({
// // //       where: {
// // //         id: request.id,
// // //       },
// // //       data: {
// // //         status: "ACCEPTED",
// // //       },
// // //     });

// // //     // Create the normal active chat session.
// // //     const chatSession = await tx.chatSession.create({
// // //       data: {
// // //         userOneId: request.senderId,
// // //         userTwoId: request.receiverId,
// // //         status: "ACTIVE",
// // //       },
// // //     });

// // //     // Ensure both users have ended queue records.
// // //     await tx.matchingQueue.upsert({
// // //       where: {
// // //         userId: request.senderId,
// // //       },
// // //       update: {
// // //         status: "MATCHED",
// // //         partnerUserId: request.receiverId,
// // //         joinedAt: new Date(),
// // //       },
// // //       create: {
// // //         userId: request.senderId,
// // //         status: "MATCHED",
// // //         partnerUserId: request.receiverId,
// // //       },
// // //     });

// // //     await tx.matchingQueue.upsert({
// // //       where: {
// // //         userId: request.receiverId,
// // //       },
// // //       update: {
// // //         status: "MATCHED",
// // //         partnerUserId: request.senderId,
// // //         joinedAt: new Date(),
// // //       },
// // //       create: {
// // //         userId: request.receiverId,
// // //         status: "MATCHED",
// // //         partnerUserId: request.senderId,
// // //       },
// // //     });

// // //     return {
// // //       request: acceptedRequest,
// // //       chatSession,
// // //       senderId: request.senderId,
// // //       receiverId: request.receiverId,
// // //     };
// // //   });
// // // }

// // /**
// //  * Decline a reconnect request.
// //  *
// //  * Only the actual receiver can decline it.
// //  * A request that is no longer PENDING cannot be declined again.
// //  */
// // export async function declineReconnectRequest(
// //   requestId: string,
// //   receiverId: string
// // ) {
// //   return await prisma.reconnectRequest.updateMany({
// //     where: {
// //       id: requestId,
// //       receiverId,
// //       status: "PENDING",
// //     },
// //     data: {
// //       status: "DECLINED",
// //     },
// //   });
// // }

// // export async function cancelReconnectRequest(
// //   requestId: string
// // ) {
// //   return await prisma.reconnectRequest.updateMany({
// //     where: {
// //       id: requestId,
// //       status: "PENDING",
// //     },
// //     data: {
// //       status: "CANCELLED",
// //     },
// //   });
// // }



// import prisma from "@/lib/db";

// export async function createReconnectRequest(
//   senderId: string,
//   receiverId: string
// ) {
//   if (senderId === receiverId) {
//     return null;
//   }

//   const previousPartner = await prisma.previousPartner.findFirst({
//     where: {
//       OR: [
//         {
//           userOneId: senderId,
//           userTwoId: receiverId,
//         },
//         {
//           userOneId: receiverId,
//           userTwoId: senderId,
//         },
//       ],
//     },
//   });

//   if (!previousPartner) {
//     return null;
//   }

//   const existingRequest = await prisma.reconnectRequest.findFirst({
//     where: {
//       OR: [
//         {
//           senderId,
//           receiverId,
//         },
//         {
//           senderId: receiverId,
//           receiverId: senderId,
//         },
//       ],
//       status: "PENDING",
//     },
//   });

//   if (existingRequest) {
//     return existingRequest;
//   }

//   return await prisma.reconnectRequest.create({
//     data: {
//       senderId,
//       receiverId,
//       status: "PENDING",
//     },
//   });
// }

// export async function getPendingReconnectRequestForUser(
//   userId: string
// ) {
//   return await prisma.reconnectRequest.findFirst({
//     where: {
//       receiverId: userId,
//       status: "PENDING",
//     },
//     orderBy: {
//       createdAt: "desc",
//     },
//   });
// }

// export async function getReconnectRequestById(
//   requestId: string
// ) {
//   return await prisma.reconnectRequest.findUnique({
//     where: {
//       id: requestId,
//     },
//   });
// }

// /**
//  * Accept a reconnect request.
//  *
//  * The receiver must own the request and the request
//  * must still be PENDING.
//  *
//  * WAITING is allowed because the reconnect sender
//  * may currently be waiting for a normal match.
//  */
// export async function acceptReconnectRequest(
//   requestId: string,
//   receiverId: string
// ) {
//   return await prisma.$transaction(async (tx) => {
//     const request = await tx.reconnectRequest.findUnique({
//       where: {
//         id: requestId,
//       },
//     });

//     if (!request) {
//       return null;
//     }

//     if (request.receiverId !== receiverId) {
//       return null;
//     }

//     if (request.status !== "PENDING") {
//       return null;
//     }

//     // Make sure they are still previous partners.
//     const previousPartner = await tx.previousPartner.findFirst({
//       where: {
//         OR: [
//           {
//             userOneId: request.senderId,
//             userTwoId: request.receiverId,
//           },
//           {
//             userOneId: request.receiverId,
//             userTwoId: request.senderId,
//           },
//         ],
//       },
//     });

//     if (!previousPartner) {
//       return null;
//     }

//     // Neither user can already be in an ACTIVE chat.
//     const activeSessions = await tx.chatSession.findMany({
//       where: {
//         status: "ACTIVE",
//         OR: [
//           {
//             userOneId: request.senderId,
//           },
//           {
//             userTwoId: request.senderId,
//           },
//           {
//             userOneId: request.receiverId,
//           },
//           {
//             userTwoId: request.receiverId,
//           },
//         ],
//       },
//       select: {
//         id: true,
//       },
//     });

//     if (activeSessions.length > 0) {
//       return null;
//     }

//     // MATCHED means the user is already connected
//     // with somebody else, so reconnect is not allowed.
//     //
//     // WAITING is intentionally allowed.
//     const matchedUsers = await tx.matchingQueue.findMany({
//       where: {
//         userId: {
//           in: [
//             request.senderId,
//             request.receiverId,
//           ],
//         },
//         status: "MATCHED",
//       },
//       select: {
//         userId: true,
//       },
//     });

//     if (matchedUsers.length > 0) {
//       return null;
//     }

//     // Accept the request.
//     const acceptedRequest =
//       await tx.reconnectRequest.update({
//         where: {
//           id: request.id,
//         },
//         data: {
//           status: "ACCEPTED",
//         },
//       });

//     // Create the normal active chat session.
//     const chatSession = await tx.chatSession.create({
//       data: {
//         userOneId: request.senderId,
//         userTwoId: request.receiverId,
//         status: "ACTIVE",
//       },
//     });

//     // Sender becomes MATCHED.
//     await tx.matchingQueue.upsert({
//       where: {
//         userId: request.senderId,
//       },
//       update: {
//         status: "MATCHED",
//         partnerUserId: request.receiverId,
//         joinedAt: new Date(),
//       },
//       create: {
//         userId: request.senderId,
//         status: "MATCHED",
//         partnerUserId: request.receiverId,
//       },
//     });

//     // Receiver becomes MATCHED.
//     await tx.matchingQueue.upsert({
//       where: {
//         userId: request.receiverId,
//       },
//       update: {
//         status: "MATCHED",
//         partnerUserId: request.senderId,
//         joinedAt: new Date(),
//       },
//       create: {
//         userId: request.receiverId,
//         status: "MATCHED",
//         partnerUserId: request.senderId,
//       },
//     });

//     // Any other pending reconnect request involving
//     // either user is no longer valid.
//     await tx.reconnectRequest.updateMany({
//       where: {
//         id: {
//           not: request.id,
//         },
//         status: "PENDING",
//         OR: [
//           {
//             senderId: request.senderId,
//           },
//           {
//             receiverId: request.senderId,
//           },
//           {
//             senderId: request.receiverId,
//           },
//           {
//             receiverId: request.receiverId,
//           },
//         ],
//       },
//       data: {
//         status: "CANCELLED",
//       },
//     });

//     return {
//       request: acceptedRequest,
//       chatSession,
//       senderId: request.senderId,
//       receiverId: request.receiverId,
//     };
//   });
// }

// /**
//  * Decline a reconnect request.
//  */
// export async function declineReconnectRequest(
//   requestId: string,
//   receiverId: string
// ) {
//   return await prisma.reconnectRequest.updateMany({
//     where: {
//       id: requestId,
//       receiverId,
//       status: "PENDING",
//     },
//     data: {
//       status: "DECLINED",
//     },
//   });
// }

// /**
//  * Cancel ALL pending reconnect requests involving
//  * this user.
//  *
//  * Used by /start, /next and /end.
//  *
//  * Returns the cancelled requests so the caller
//  * can notify both users.
//  */
// export async function cancelPendingReconnectRequests(
//   userId: string
// ) {
//   const pendingRequests =
//     await prisma.reconnectRequest.findMany({
//       where: {
//         status: "PENDING",
//         OR: [
//           {
//             senderId: userId,
//           },
//           {
//             receiverId: userId,
//           },
//         ],
//       },
//     });

//   if (pendingRequests.length === 0) {
//     return [];
//   }

//   await prisma.reconnectRequest.updateMany({
//     where: {
//       id: {
//         in: pendingRequests.map(
//           (request) => request.id
//         ),
//       },
//       status: "PENDING",
//     },
//     data: {
//       status: "CANCELLED",
//     },
//   });

//   return pendingRequests;
// }

// /**
//  * Cancel one specific pending reconnect request.
//  */
// export async function cancelReconnectRequest(
//   requestId: string
// ) {
//   return await prisma.reconnectRequest.updateMany({
//     where: {
//       id: requestId,
//       status: "PENDING",
//     },
//     data: {
//       status: "CANCELLED",
//     },
//   });
// }



import prisma from "@/lib/db";

export async function createReconnectRequest(
  senderId: string,
  receiverId: string
) {
  if (senderId === receiverId) {
    return null;
  }

  const previousPartner =
    await prisma.previousPartner.findFirst({
      where: {
        OR: [
          {
            userOneId: senderId,
            userTwoId: receiverId,
          },
          {
            userOneId: receiverId,
            userTwoId: senderId,
          },
        ],
      },
    });

  if (!previousPartner) {
    return null;
  }

  const existingRequest =
    await prisma.reconnectRequest.findFirst({
      where: {
        OR: [
          {
            senderId,
            receiverId,
          },
          {
            senderId: receiverId,
            receiverId: senderId,
          },
        ],
        status: "PENDING",
      },
    });

  if (existingRequest) {
    return existingRequest;
  }

  // Sender must not remain in the normal
  // matching queue while reconnect is pending.
  await prisma.matchingQueue.updateMany({
    where: {
      userId: senderId,
      status: "WAITING",
    },
    data: {
      status: "ENDED",
      partnerUserId: null,
    },
  });

  return await prisma.reconnectRequest.create({
    data: {
      senderId,
      receiverId,
      status: "PENDING",
    },
  });
}

export async function getPendingReconnectRequestForUser(
  userId: string
) {
  return await prisma.reconnectRequest.findFirst({
    where: {
      receiverId: userId,
      status: "PENDING",
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getReconnectRequestById(
  requestId: string
) {
  return await prisma.reconnectRequest.findUnique({
    where: {
      id: requestId,
    },
  });
}

/**
 * Accept a reconnect request.
 *
 * Only the receiver can accept it.
 * The request must still be PENDING.
 *
 * Neither user may currently be in another
 * active chat.
 */
export async function acceptReconnectRequest(
  requestId: string,
  receiverId: string
) {
  return await prisma.$transaction(
    async (tx) => {
      // ========================================
      // LOCK / LOAD REQUEST
      // ========================================

      const request =
        await tx.reconnectRequest.findUnique({
          where: {
            id: requestId,
          },
        });

      if (!request) {
        return null;
      }

      // Receiver security check.
      if (request.receiverId !== receiverId) {
        return null;
      }

      // Only PENDING requests can be accepted.
      if (request.status !== "PENDING") {
        return null;
      }

      // ========================================
      // VERIFY PREVIOUS PARTNER RELATIONSHIP
      // ========================================

      const previousPartner =
        await tx.previousPartner.findFirst({
          where: {
            OR: [
              {
                userOneId: request.senderId,
                userTwoId: request.receiverId,
              },
              {
                userOneId: request.receiverId,
                userTwoId: request.senderId,
              },
            ],
          },
        });

      if (!previousPartner) {
        return null;
      }

      // ========================================
      // CHECK ACTIVE CHAT
      // ========================================

      const activeSessions =
        await tx.chatSession.findMany({
          where: {
            status: "ACTIVE",
            OR: [
              {
                userOneId: request.senderId,
              },
              {
                userTwoId: request.senderId,
              },
              {
                userOneId: request.receiverId,
              },
              {
                userTwoId: request.receiverId,
              },
            ],
          },
          select: {
            id: true,
          },
        });

      if (activeSessions.length > 0) {
        return null;
      }

      // ========================================
      // CHECK MATCHED QUEUE
      // ========================================

      const matchedUsers =
        await tx.matchingQueue.findMany({
          where: {
            userId: {
              in: [
                request.senderId,
                request.receiverId,
              ],
            },
            status: "MATCHED",
          },
          select: {
            userId: true,
          },
        });

      if (matchedUsers.length > 0) {
        return null;
      }

      // ========================================
      // ACCEPT REQUEST
      // ========================================

      const acceptedRequest =
        await tx.reconnectRequest.update({
          where: {
            id: request.id,
          },
          data: {
            status: "ACCEPTED",
          },
        });

      // ========================================
      // CREATE NORMAL CHAT SESSION
      // ========================================

      const chatSession =
        await tx.chatSession.create({
          data: {
            userOneId: request.senderId,
            userTwoId: request.receiverId,
            status: "ACTIVE",
          },
        });

      // ========================================
      // SENDER -> MATCHED
      // ========================================

      await tx.matchingQueue.upsert({
        where: {
          userId: request.senderId,
        },
        update: {
          status: "MATCHED",
          partnerUserId: request.receiverId,
          joinedAt: new Date(),
        },
        create: {
          userId: request.senderId,
          status: "MATCHED",
          partnerUserId: request.receiverId,
        },
      });

      // ========================================
      // RECEIVER -> MATCHED
      // ========================================

      await tx.matchingQueue.upsert({
        where: {
          userId: request.receiverId,
        },
        update: {
          status: "MATCHED",
          partnerUserId: request.senderId,
          joinedAt: new Date(),
        },
        create: {
          userId: request.receiverId,
          status: "MATCHED",
          partnerUserId: request.senderId,
        },
      });

      // ========================================
      // CANCEL OTHER PENDING REQUESTS
      // ========================================

      await tx.reconnectRequest.updateMany({
        where: {
          id: {
            not: request.id,
          },
          status: "PENDING",
          OR: [
            {
              senderId: request.senderId,
            },
            {
              receiverId: request.senderId,
            },
            {
              senderId: request.receiverId,
            },
            {
              receiverId: request.receiverId,
            },
          ],
        },
        data: {
          status: "CANCELLED",
        },
      });

      return {
        request: acceptedRequest,
        chatSession,
        senderId: request.senderId,
        receiverId: request.receiverId,
      };
    },
    {
      timeout: 30000,
      maxWait: 10000,
    }
  );
}

/**
 * Decline a reconnect request.
 */
export async function declineReconnectRequest(
  requestId: string,
  receiverId: string
) {
  return await prisma.reconnectRequest.updateMany({
    where: {
      id: requestId,
      receiverId,
      status: "PENDING",
    },
    data: {
      status: "DECLINED",
    },
  });
}

/**
 * Cancel all pending reconnect requests involving
 * this user.
 *
 * Used by:
 * /start
 * /next
 * /end
 */
export async function cancelPendingReconnectRequests(
  userId: string
) {
  const pendingRequests =
    await prisma.reconnectRequest.findMany({
      where: {
        status: "PENDING",
        OR: [
          {
            senderId: userId,
          },
          {
            receiverId: userId,
          },
        ],
      },
    });

  if (pendingRequests.length === 0) {
    return [];
  }

  await prisma.reconnectRequest.updateMany({
    where: {
      id: {
        in: pendingRequests.map(
          (request) => request.id
        ),
      },
      status: "PENDING",
    },
    data: {
      status: "CANCELLED",
    },
  });

  return pendingRequests;
}

/**
 * Cancel one specific pending reconnect request.
 */
export async function cancelReconnectRequest(
  requestId: string
) {
  return await prisma.reconnectRequest.updateMany({
    where: {
      id: requestId,
      status: "PENDING",
    },
    data: {
      status: "CANCELLED",
    },
  });
}