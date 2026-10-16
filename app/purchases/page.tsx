"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface PurchaseRecord {
  id: string;
  orderType: string;
  packageName: string;
  amountPaid: number;
  starsAmount: number | null;
  pointsAmount: number;
  currency: string;
  provider: string;
  status: string;
  telegramPaymentChargeId: string | null;
  orderPayload: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  vipStart: string | null;
  vipExpiration: string | null;
  subscriptionStatus: string | null;
}

interface UserProfile {
  id: string;
  telegramUserId: string;
  firstName: string;
  username: string | null;
  pointsBalance: number;
  isVip: boolean;
  activeVipPlan: string | null;
  vipExpiresAt: string | null;
  remainingDays: number;
  remainingHours: number;
  isProfileComplete: boolean;
}

function PurchasesContent() {
  const searchParams = useSearchParams();
  const queryTelegramId = searchParams.get("telegramUserId") || "";

  const [inputTelegramId, setInputTelegramId] = useState(queryTelegramId);
  const [activeTelegramId, setActiveTelegramId] = useState(queryTelegramId);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<PurchaseRecord | null>(null);

  const loadUserData = useCallback(async (telegramId: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/user/purchases?telegramUserId=${telegramId}`);
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        setPurchases(data.purchases || []);
      } else {
        setError(data.error || "Profile not found");
        setUser(null);
        setPurchases([]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load purchases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTelegramId) {
      loadUserData(activeTelegramId);
    }
  }, [activeTelegramId, loadUserData]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const clean = inputTelegramId.trim();
    if (clean) {
      setActiveTelegramId(clean);
    }
  }

  const filteredPurchases = purchases.filter((p) => {
    if (!statusFilter) return true;
    return p.status === statusFilter;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/talkbuddy-dp.jpg"
              alt="TalkBuddy Logo"
              className="w-9 h-9 rounded-xl object-cover shadow-lg shadow-indigo-600/30 border border-indigo-500/20"
            />
            <span className="font-extrabold text-white text-base tracking-tight">
              TalkBuddy <span className="text-indigo-400 font-normal">VIP & Receipts</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <a
              href="https://t.me/TalkBuddyGlobalBot"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20"
            >
              Open Bot
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Lookup Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">
                Inspect Your VIP Membership & Purchase Ledger
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Enter your verified Telegram User ID (find it using <code>/myid</code> in the bot) to audit your purchases and subscriptions.
              </p>
            </div>
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Telegram User ID (e.g. 123456789)"
                value={inputTelegramId}
                onChange={(e) => setInputTelegramId(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-white rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-indigo-500 w-56 font-mono"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/30"
              >
                {loading ? "Loading..." : "Search"}
              </button>
            </form>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
              ⚠️ {error}. Please verify your Telegram User ID or start the bot with <code>/start</code>.
            </div>
          )}
        </div>

        {/* User Membership & Balance Card */}
        {user && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* VIP Status Card */}
            <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">👑</span>
                    <div>
                      <h2 className="text-lg font-bold text-white">
                        {user.activeVipPlan || (user.isVip ? "Active VIP Membership" : "Standard Free Plan")}
                      </h2>
                      <p className="text-xs text-slate-400">
                        User: <b className="text-slate-200">{user.firstName}</b> {user.username ? `(@${user.username})` : ""}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      user.isVip
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/20"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                    }`}
                  >
                    {user.isVip ? "● VIP ACTIVE" : "○ FREE TIER"}
                  </span>
                </div>

                {/* Expiration Details */}
                {user.isVip && user.vipExpiresAt ? (
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-400">Subscription Validity:</span>
                      <span className="text-purple-300 font-bold">
                        {user.remainingDays} days, {user.remainingHours} hours remaining
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Valid until: <b>{new Date(user.vipExpiresAt).toLocaleString()}</b>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400">
                    No active VIP subscription. Upgrade in Telegram to skip matchmaking queues and unlock gender filtering.
                  </div>
                )}

                {/* Perks Checklist */}
                <div>
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Unlocked Privileges:
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={`flex items-center gap-1.5 ${user.isVip ? "text-emerald-300" : "text-slate-500"}`}>
                      <span>{user.isVip ? "✅" : "🔒"}</span> Gender Matching Filter
                    </div>
                    <div className={`flex items-center gap-1.5 ${user.isVip ? "text-emerald-300" : "text-slate-500"}`}>
                      <span>{user.isVip ? "✅" : "🔒"}</span> Priority Matchmaking Queue
                    </div>
                    <div className={`flex items-center gap-1.5 ${user.isVip ? "text-emerald-300" : "text-slate-500"}`}>
                      <span>{user.isVip ? "✅" : "🔒"}</span> Unlimited Conversations
                    </div>
                    <div className={`flex items-center gap-1.5 ${user.isVip ? "text-emerald-300" : "text-slate-500"}`}>
                      <span>{user.isVip ? "✅" : "🔒"}</span> Remote Message Wipe (<code>/delete</code>)
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80 mt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Profile Status: {user.isProfileComplete ? "Verified" : "Pending Profile Info"}
                </span>
                <a
                  href="https://t.me/TalkBuddyGlobalBot?start=vip"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-600/20"
                >
                  {user.isVip ? "Extend / Renew VIP" : "Upgrade to VIP"}
                </a>
              </div>
            </div>

            {/* Points Balance Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  Verified Points Balance
                </span>
                <div className="text-4xl font-black text-white mt-2">
                  {user.pointsBalance.toLocaleString()}{" "}
                  <span className="text-sm font-normal text-slate-400">Points</span>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Internal TalkBuddy Points earned via chat bonuses, referrals, and daily rewards. Used for saving contacts and VIP upgrades.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Save Partner:</span>
                  <span className="font-bold text-white">10 pts</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Daily Bonus:</span>
                  <span className="font-bold text-emerald-400">+25 pts / 24h</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Invite Friends:</span>
                  <span className="font-bold text-indigo-400">+50 pts each</span>
                </div>
              </div>

              <a
                href="https://t.me/TalkBuddyGlobalBot"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
              >
                Top-up in Telegram
              </a>
            </div>
          </div>
        )}

        {/* Purchase History Table */}
        {user && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Purchase History & Financial Invoices ({purchases.length})
                </h2>
                <p className="text-xs text-slate-400">
                  Every order initiated, completed, or refunded is permanently recorded.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">Filter Status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                >
                  <option value="">All Purchases</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="REFUNDED">REFUNDED</option>
                  <option value="PENDING">PENDING</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Purchase ID</th>
                      <th className="py-3 px-4">Package Name</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Currency</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Purchase Date</th>
                      <th className="py-3 px-4">VIP Expiration</th>
                      <th className="py-3 px-4">Telegram Charge Ref</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {filteredPurchases.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500">
                          No purchases found.
                        </td>
                      </tr>
                    ) : (
                      filteredPurchases.map((p) => {
                        const amountDisplay =
                          p.currency === "XTR"
                            ? `⭐ ${p.starsAmount ?? p.amountPaid}`
                            : p.currency === "POINTS"
                            ? `💎 ${p.pointsAmount}`
                            : `$${p.amountPaid.toFixed(2)}`;

                        return (
                          <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                              {p.id.substring(0, 8)}...
                            </td>
                            <td className="py-3 px-4 font-bold text-white">
                              {p.packageName}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-200">
                              {amountDisplay}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  p.currency === "XTR"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : p.currency === "POINTS"
                                    ? "bg-indigo-500/20 text-indigo-300"
                                    : "bg-emerald-500/20 text-emerald-300"
                                }`}
                              >
                                {p.currency}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  p.status === "COMPLETED"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : p.status === "REFUNDED"
                                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                    : p.status === "PENDING"
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-400 text-[11px]">
                              {new Date(p.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-[11px]">
                              {p.vipExpiration ? (
                                <span className="text-purple-300 font-semibold">
                                  {new Date(p.vipExpiration).toLocaleDateString()}
                                </span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-[10px] text-slate-400">
                              {p.telegramPaymentChargeId ? (
                                <span title={p.telegramPaymentChargeId}>
                                  {p.telegramPaymentChargeId.substring(0, 14)}...
                                </span>
                              ) : (
                                <span className="text-slate-600">None</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => setSelectedReceipt(p)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold rounded-lg border border-slate-700 transition-colors"
                              >
                                🧾 Receipt
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Receipt Details */}
        {selectedReceipt && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🧾 Official Purchase Receipt</span>
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedReceipt.status === "COMPLETED"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {selectedReceipt.status}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Order Reference:</span>
                  <span className="font-mono text-white">{selectedReceipt.id}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Item Purchased:</span>
                  <span className="font-bold text-white">{selectedReceipt.packageName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Payment Currency:</span>
                  <span className="font-bold text-amber-300">{selectedReceipt.currency}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Amount Charged:</span>
                  <span className="font-black text-white">
                    {selectedReceipt.currency === "XTR"
                      ? `⭐ ${selectedReceipt.starsAmount ?? selectedReceipt.amountPaid} Stars`
                      : selectedReceipt.currency === "POINTS"
                      ? `💎 ${selectedReceipt.pointsAmount} Points`
                      : `$${selectedReceipt.amountPaid}`}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Provider:</span>
                  <span className="text-slate-200">{selectedReceipt.provider}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Telegram Charge ID:</span>
                  <span className="font-mono text-slate-300">
                    {selectedReceipt.telegramPaymentChargeId || "N/A (Points/Admin)"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Initiated At:</span>
                  <span className="text-slate-300">{new Date(selectedReceipt.createdAt).toLocaleString()}</span>
                </div>
                {selectedReceipt.vipExpiration && (
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-purple-300 font-semibold">VIP Valid Until:</span>
                    <span className="text-purple-300 font-bold">
                      {new Date(selectedReceipt.vipExpiration).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
                >
                  Close Receipt
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function PurchasesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white p-8 text-center">Loading purchases...</div>}>
      <PurchasesContent />
    </Suspense>
  );
}
