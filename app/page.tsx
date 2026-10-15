import Link from "next/link";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Fetch real-time statistics
  let stats = {
    users: 0,
    vip: 0,
    activeChats: 0,
    messages: 0,
    packages: 0,
  };

  try {
    const [userCount, vipCount, sessionCount, msgCount, pkgCount] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isVip: true } }),
        prisma.chatSession.count({ where: { status: "ACTIVE" } }),
        prisma.chatMessage.count(),
        prisma.pointsPackage.count({ where: { isActive: true } }),
      ]);

    stats = {
      users: userCount,
      vip: vipCount,
      activeChats: sessionCount,
      messages: msgCount,
      packages: pkgCount,
    };
  } catch (err) {
    console.error("Home stats error:", err);
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "TalkBuddyGlobalBot";
  const telegramBotUrl = `https://t.me/${botUsername}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/talkbuddy-dp.jpg"
              alt="TalkBuddy Logo"
              className="w-10 h-10 rounded-xl object-cover shadow-lg shadow-indigo-600/30 border border-indigo-500/20"
            />
            <div>
              <span className="font-extrabold text-lg text-white tracking-tight">
                TalkBuddy
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Telegram Chat System
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/purchases"
              className="text-xs font-semibold text-slate-300 hover:text-white px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              💳 Purchases & VIP
            </Link>
            <Link
              href="/admin"
              className="text-xs font-semibold text-slate-300 hover:text-white px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              📊 Admin Portal
            </Link>
            <a
              href={telegramBotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
            >
              <span>🚀 Launch Bot</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col">
        <section className="py-20 px-6 max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-semibold animate-pulse">
            <span>✨ Connect Globally • Earn Points • Anonymous Telegram Chat</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
            Talk to Strangers Anonymously.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-amber-300">
              Earn Rewards & VIP Perks.
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-400 leading-relaxed">
            TalkBuddy is a next-generation Telegram chat ecosystem. Meet genuine people anonymously,
            earn points for every chat session, claim daily rewards, and unlock VIP privileges with ease.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <a
              href={telegramBotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:opacity-95 text-white font-bold text-base rounded-2xl transition-all shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3"
            >
              <span>🤖 Start Chatting on Telegram</span>
              <span>→</span>
            </a>
            <Link
              href="/admin"
              className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-base rounded-2xl border border-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              <span>⚙️ Open Management Dashboard</span>
            </Link>
          </div>

          {/* Real-time stats bar */}
          <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-extrabold text-white">
                {stats.users.toLocaleString()}
              </div>
              <div className="text-xs text-slate-400 mt-1">Verified Users</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300">
                {stats.activeChats.toLocaleString()}
              </div>
              <div className="text-xs text-slate-400 mt-1">Active Live Chats</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-300">
                {stats.vip.toLocaleString()}
              </div>
              <div className="text-xs text-slate-400 mt-1">VIP Members</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
              <div className="text-2xl sm:text-3xl font-extrabold text-indigo-300">
                {stats.messages.toLocaleString()}
              </div>
              <div className="text-xs text-slate-400 mt-1">Messages Exchanged</div>
            </div>
          </div>
        </section>

        {/* System Features Section */}
        <section className="py-16 px-6 bg-slate-900/40 border-y border-slate-900">
          <div className="max-w-7xl mx-auto space-y-12">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-extrabold text-white">
                Engineered for Safe, Rewarding Conversations
              </h2>
              <p className="text-slate-400 text-sm max-w-xl mx-auto">
                Explore how the point-earning mechanics, anonymous matching engine, and payment system work seamlessly together.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-950 border border-indigo-800/60 flex items-center justify-center text-2xl">
                  🔒
                </div>
                <h3 className="text-lg font-bold text-white">100% Anonymous Chatting</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your Telegram handle, phone number, and identity remain fully private. Connect with random people instantly using gender preferences.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-950 border border-amber-800/60 flex items-center justify-center text-2xl">
                  💰
                </div>
                <h3 className="text-lg font-bold text-white">Point Earning & Rewards</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Earn points automatically through daily login rewards (+25 pts), inviting friends via referral (+50 pts), and completing active conversations (+5 pts).
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-800/60 flex items-center justify-center text-2xl">
                  💳
                </div>
                <h3 className="text-lg font-bold text-white">Telegram Stars & Payments</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Top up your points balance instantly using Telegram Stars or payment packages to save partners, reconnect anytime, and activate VIP passes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* VIP Plans & Point Packages Showcase */}
        <section className="py-16 px-6 max-w-7xl mx-auto w-full space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
              VIP Power-Ups & Store Packages
            </span>
            <h2 className="text-3xl font-extrabold text-white">
              Unlock the Full Power of TalkBuddy
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Points packages can be purchased via Telegram Stars or credited directly from the administrative portal.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 uppercase">
                Starter
              </span>
              <h3 className="text-xl font-bold text-white">Starter Pack</h3>
              <div className="text-3xl font-extrabold text-indigo-400">100 pts</div>
              <p className="text-xs text-slate-400">
                Perfect for first-time chatters to save favorite contacts and reconnect.
              </p>
              <div className="pt-2 text-sm font-semibold text-slate-200">
                $0.99 USD / 50 ⭐
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                Popular
              </span>
              <h3 className="text-xl font-bold text-white">Chatter Pack</h3>
              <div className="text-3xl font-extrabold text-indigo-400">350 pts</div>
              <p className="text-xs text-slate-400">
                Unlock 1 month of VIP access or save up to 35 previous partners.
              </p>
              <div className="pt-2 text-sm font-semibold text-slate-200">
                $2.99 USD / 150 ⭐
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-b from-amber-950/40 to-slate-900 border border-amber-500/30 space-y-4">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                Best Value
              </span>
              <h3 className="text-xl font-bold text-white">VIP Power Pack</h3>
              <div className="text-3xl font-extrabold text-amber-300">1,000 pts</div>
              <p className="text-xs text-slate-400">
                Full VIP status for 3+ months, priority matching queue, and unlimited contact tags.
              </p>
              <div className="pt-2 text-sm font-semibold text-slate-200">
                $7.99 USD / 400 ⭐
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                Ultimate
              </span>
              <h3 className="text-xl font-bold text-white">Elite Whale Pack</h3>
              <div className="text-3xl font-extrabold text-purple-300">2,500 pts</div>
              <p className="text-xs text-slate-400">
                The ultimate points booster for power users and community ambassadors.
              </p>
              <div className="pt-2 text-sm font-semibold text-slate-200">
                $17.99 USD / 900 ⭐
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} TalkBuddy Telegram Chatting System. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <Link href="/admin" className="hover:text-slate-300 transition-colors">
              Admin Portal
            </Link>
            <Link href="/admin/payments" className="hover:text-slate-300 transition-colors">
              Payments Ledger
            </Link>
            <a
              href={telegramBotUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Open Telegram Bot →
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
