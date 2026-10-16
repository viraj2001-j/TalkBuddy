// import type { Telegraf } from "telegraf";

// export function getGenderKeyboard() {
//   return {
//     inline_keyboard: [
//       [
//         {
//           text: "👨 Male",
//           callback_data: "gender_male",
//         },
//         {
//           text: "👩 Female",
//           callback_data: "gender_female",
//         },
//       ],
//       [
//         {
//           text: "🏳️‍⚧️ Trans Man",
//           callback_data: "gender_trans_man",
//         },
//         {
//           text: "🏳️‍⚧️ Trans Woman",
//           callback_data: "gender_trans_woman",
//         },
//       ],
//       [
//         {
//           text: "🧑 Non-binary",
//           callback_data: "gender_non_binary",
//         },
//       ],
//     ],
//   };
// }

// export function getMainMenuKeyboard() {
//   return {
//     inline_keyboard: [
//       [
//         {
//           text: "🔎 Find Someone",
//           callback_data: "menu_find",
//         },
//       ],
//       [
//         {
//           text: "👤 My Profile",
//           callback_data: "menu_profile",
//         },
//       ],
//       [
//         {
//           text: "🛡️ Safety & Privacy",
//           callback_data: "menu_safety",
//         },
//       ],
//             [
//         {
//           text: "💎 VIP",
//           callback_data: "vip_info",
//         },
//       ],
//     ],
//   };
// }

// export async function setupBotMenu(bot: Telegraf) {
//   await bot.telegram.setMyCommands([
//     {
//       command: "start",
//       description: "Start a chat with a random user",
//     },
//     {
//       command: "next",
//       description: "Find a new chat partner",
//     },
//     {
//       command: "end",
//       description: "End the current chat",
//     },
//         {
//       command: "vip",
//       description: "View TalkBuddy VIP",
//     },
//   ]);
// }

// // export function getWaitingPartnerKeyboard() {
// //   return {
// //     inline_keyboard: [
// //       [
// //         {
// //           text: "🔄 Reconnect previous user",
// //           callback_data: "reconnect_previous",
// //         },
// //       ],
// //       [
// //         {
// //           text: "💾 Save previous user",
// //           callback_data: "save_previous",
// //         },
// //       ],
// //     ],
// //   };
// // }

// export function getWaitingPartnerKeyboard() {
//   return {
//     inline_keyboard: [
//       [
//         {
//           text: "🔄 Reconnect previous user",
//           callback_data: "reconnect_previous",
//         },
//         {
//           text: "💾 Save previous user",
//           callback_data: "save_previous",
//         },
//       ],
//     ],
//   };
// }

// export function getConnectedKeyboard() {
//   return {
//     inline_keyboard: [
//       [
//         {
//           text: "💎 View VIP",
//           callback_data: "vip_info",
//         },
//       ],
//     ],
//   };
// }

import type { Telegraf } from "telegraf";

export function getGenderKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "👨 Male",
          callback_data: "gender_male",
        },
        {
          text: "👩 Female",
          callback_data: "gender_female",
        },
      ],
      [
        {
          text: "🏳️‍⚧️ Trans Man",
          callback_data: "gender_trans_man",
        },
        {
          text: "🏳️‍⚧️ Trans Woman",
          callback_data: "gender_trans_woman",
        },
      ],
      [
        {
          text: "🧑 Non-binary",
          callback_data: "gender_non_binary",
        },
      ],
    ],
  };
}

export function getMainMenuKeyboard(isVip: boolean = false) {
  const keyboard: any[][] = [
    [
      {
        text: "🔎 Find Someone",
        callback_data: "menu_find",
      },
    ],
  ];

  if (isVip) {
    keyboard.push([
      {
        text: "🎯 VIP Gender Filter",
        callback_data: "vip_filter_select",
      },
    ]);
  }

  keyboard.push(
    [
      {
        text: "👑 VIP Plans (⭐ Stars)",
        callback_data: "vip_info",
      },
    ],
    [
      {
        text: "👤 My Profile",
        callback_data: "menu_profile",
      },
      {
        text: "⚙️ Settings",
        callback_data: "menu_settings",
      },
    ],
    [
      {
        text: "🛡️ Safety & Privacy",
        callback_data: "menu_safety",
      },
    ]
  );

  return {
    inline_keyboard: keyboard,
  };
}

export function getEarnMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "👑 VIP Plans (⭐ Stars)",
          callback_data: "vip_info",
        },
      ],
      [
        {
          text: "👥 Invite Friends (Referrals)",
          callback_data: "earn_referral",
        },
        {
          text: "⬅️ Back to Menu",
          callback_data: "back_main_menu",
        },
      ],
    ],
  };
}

export function getWaitingPartnerKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "🔄 Reconnect previous user",
          callback_data: "reconnect_previous",
        },
        {
          text: "💾 Save previous user",
          callback_data: "save_previous",
        },
      ],
      [
        {
          text: "👑 VIP Plans (⭐ Stars)",
          callback_data: "vip_info",
        },
      ],
    ],
  };
}

export function getConnectedKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "💎 View VIP",
          callback_data: "vip_info",
        },
      ],
    ],
  };
}

export function getVipKeyboard(isVip: boolean = false) {
  const keyboard: any[][] = [];

  if (isVip) {
    keyboard.push([
      {
        text: "🎯 Choose Gender Filter",
        callback_data: "vip_filter_select",
      },
    ]);
  }

  keyboard.push(
    [
      {
        text: "👑 1 Week (⭐ 50 Stars)",
        callback_data: "vip_buy_1w",
      },
      {
        text: "👑 1 Month (⭐ 150 Stars)",
        callback_data: "vip_buy_1m",
      },
    ],
    [
      {
        text: "👑 3 Months (⭐ 400 Stars)",
        callback_data: "vip_buy_3m",
      },
      {
        text: "👑 6 Months (⭐ 750 Stars)",
        callback_data: "vip_buy_6m",
      },
    ],
    [
      {
        text: "📜 My Purchase History",
        callback_data: "vip_history",
      },
      {
        text: "⬅️ Back to Menu",
        callback_data: "back_main_menu",
      },
    ]
  );

  return {
    inline_keyboard: keyboard,
  };
}

export async function setupBotMenu(bot: Telegraf) {
  const commands = [
    {
      command: "start",
      description: "Start a chat with a random user",
    },
    {
      command: "search",
      description: "👤 Finds a random user",
    },
    {
      command: "next",
      description: "➡️ Ends the current chat and finds a new match",
    },
    {
      command: "stop",
      description: "🛑 Ends the conversation",
    },
    {
      command: "end",
      description: "End the current chat",
    },
    {
      command: "link",
      description: "🔗 Send Telegram profile URL to your partner",
    },
    {
      command: "reopen",
      description: "🔄 Send Invites to reopen past conversations.",
    },
    {
      command: "translate",
      description: "🌐 Translate any message you reply to your language",
    },
    {
      command: "menu",
      description: "🌍 Open the TalkBuddy main menu",
    },
    {
      command: "profile",
      description: "👤 View your profile and VIP status",
    },
    {
      command: "vip",
      description: "👑 VIP Plans (⭐ Telegram Stars)",
    },
    {
      command: "premium",
      description: "⭐ Buy VIP with Telegram Stars",
    },
    {
      command: "balance",
      description: "⭐ Check VIP & Stars status",
    },
    {
      command: "earn",
      description: "⭐ VIP Privileges & Referrals",
    },
    {
      command: "history",
      description: "📜 View your Telegram Stars purchase history",
    },
    {
      command: "cancel",
      description: "🗑️ Cancel operation",
    },
    {
      command: "truth",
      description: "🧐 Receive a Truth question",
    },
    {
      command: "dare",
      description: "🎲 Receive a Dare challenge",
    },
    {
      command: "refer",
      description: "🧑‍🤝‍🧑 Refer a Friend to get a Free PREMIUM subscription!",
    },
    {
      command: "reference",
      description: "🧑‍🤝‍🧑 Your referral link and stats",
    },
    {
      command: "filter",
      description: "🎯 VIP partner gender filter",
    },
    {
      command: "settings",
      description: "⚙️ Change your gender, age and other settings",
    },
    {
      command: "setting",
      description: "⚙️ Open user settings and profile",
    },
    {
      command: "promocode",
      description: "🎟️ Use a promo code for premium packages",
    },
    {
      command: "about",
      description: "❓ To view the help, rules, and terms of the bot",
    },
    {
      command: "myid",
      description: "🆔 View your telegram account ID",
    },
    {
      command: "paysupport",
      description: "💰 Payment support",
    },
  ];

  await bot.telegram.setMyCommands(commands);
  try {
    await bot.telegram.setMyCommands(commands, {
      scope: { type: "all_private_chats" },
    });
  } catch (err) {
    console.error("Failed to set commands for all_private_chats:", err);
  }
}