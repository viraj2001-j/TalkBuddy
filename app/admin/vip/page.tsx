"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface VipUser {
  id: string;
  telegramUserId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  gender: string;
  age: number | null;
  country: string | null;
  isProfileComplete: boolean;
  isVerified: boolean;
  genderFilterPreference: string | null;
  activeVipPlan: string | null;
  vipExpiresAt: string | null;
  pointsBalance: number;
  createdAt: string;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  createdAt: string;
  user: {
    id: string;
    telegramUserId: string;
    firstName: string;
    username: string | null;
  };
}

interface UserOption {
  id: string;
  firstName: string;
  username: string | null;
  telegramUserId: string;
}

function VipLedgerContent() {
  const searchParams = useSearchParams();
  const urlGender = searchParams.get("gender") || "";
  const urlVerified = searchParams.get("verified") || "";
  const urlCountry = searchParams.get("country") || "";

  const [vipUsers, setVipUsers] = useState<VipUser[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [txTypeFilter, setTxTypeFilter] = useState("");

  // Grant VIP modal
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [usersList, setUsersList] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [planLabel, setPlanLabel] = useState<string>("1 Month VIP Pass");
  const [durationDays, setDurationDays] = useState<number>(30);
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    fetchVipData();
  }, [urlGender, urlVerified, urlCountry]);

  async function fetchVipData() {
    try {
      setLoading(true);
      const url = new URL("/api/admin/vip", window.location.origin);
      if (urlGender && urlGender !== "ALL") url.searchParams.set("gender", urlGender);
      if (urlVerified) url.searchParams.set("verified", urlVerified);
      if (urlCountry && urlCountry !== "ALL") url.searchParams.set("country", urlCountry);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setVipUsers(data.vipUsers || []);
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenGrantModal() {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success && data.users.length > 0) {
        setUsersList(data.users);
        if (!selectedUserId) {
          setSelectedUserId(data.users[0].id);
        }
      }
      setGrantModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleGrantVip() {
    if (!selectedUserId) {
      alert("Please select a user");
      return;
    }
    try {
      setGranting(true);
      const res = await fetch("/api/admin/vip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          planLabel,
          durationDays,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGrantModalOpen(false);
        fetchVipData();
      } else {
        alert("Error granting VIP: " + data.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setGranting(false);
    }
  }

  async function handleRevokeVip(userId: string, name: string) {
    if (!confirm(`Are you sure you want to revoke VIP from "${name}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/vip?userId=${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        fetchVipData();
      } else {
        alert("Error revoking VIP: " + data.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  }

  const filteredTransactions = txTypeFilter
    ? transactions.filter((t) => t.type === txTypeFilter)
    : transactions;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>👑</span>
            <span>VIP Management & Points Ledger</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Monitor active VIP memberships, verify profiles, inspect Gender Filter preferences, and audit points transactions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenGrantModal}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-amber-600/30 flex items-center gap-2"
          >
            👑 Grant VIP Manually
          </button>
          <button
            onClick={fetchVipData}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-medium rounded-xl transition-colors border border-slate-700"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Active Filter Badges */}
      {(urlGender || urlVerified || urlCountry) && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-amber-950/20 border border-amber-900/40 rounded-xl text-xs text-slate-300">
          <span className="font-semibold text-amber-400">Sidebar Filters Active:</span>
          {urlGender && urlGender !== "ALL" && (
            <span className="px-2 py-0.5 rounded bg-indigo-600/30 text-indigo-200 border border-indigo-500/30">
              🚻 Gender: {urlGender}
            </span>
          )}
          {urlVerified && (
            <span className="px-2 py-0.5 rounded bg-emerald-600/30 text-emerald-200 border border-emerald-500/30">
              🛡️ Verification: {urlVerified === "true" ? "Verified" : "Incomplete"}
            </span>
          )}
          {urlCountry && urlCountry !== "ALL" && (
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
              🌍 Country: {urlCountry}
            </span>
          )}
        </div>
      )}

      {/* SECTION 1: ACTIVE VIP MEMBERS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🌟</span>
            <span>Active VIP Subscribers ({vipUsers.length})</span>
          </h2>
          <span className="text-xs text-slate-400">
            Real-time subscriber pool
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-5 py-4">User</th>
                  <th className="px-5 py-4">Telegram ID</th>
                  <th className="px-5 py-4">Gender / Age / Country</th>
                  <th className="px-5 py-4">Verification</th>
                  <th className="px-5 py-4">Gender Filter</th>
                  <th className="px-5 py-4">Active Plan & Expiry</th>
                  <th className="px-5 py-4">Balance</th>
                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      Loading VIP subscribers...
                    </td>
                  </tr>
                ) : vipUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      No active VIP members found. Grant VIP above or users can upgrade with points!
                    </td>
                  </tr>
                ) : (
                  vipUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-white">
                          {u.firstName} {u.lastName || ""}
                        </div>
                        {u.username && (
                          <div className="text-xs text-amber-400">@{u.username}</div>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-400">
                        {u.telegramUserId}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        <div className="font-medium text-slate-200">
                          {u.gender || "Not set"}
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          {u.age ? `${u.age} yrs` : "Age: —"} • {u.country || "Country: —"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {u.isProfileComplete ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 w-fit">
                            <span>✅</span> Verified
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 w-fit">
                            ⚠️ Incomplete
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 flex items-center gap-1 w-fit">
                          <span>🎯</span> Wants: {u.genderFilterPreference || "ANY"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-amber-300 text-xs">
                          {u.activeVipPlan || "VIP Pass"}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Expires:{" "}
                          {u.vipExpiresAt
                            ? new Date(u.vipExpiresAt).toLocaleDateString()
                            : "Indefinite"}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-bold text-indigo-300">
                        💰 {u.pointsBalance} pts
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => handleRevokeVip(u.id, u.firstName)}
                          className="px-3 py-1 bg-rose-950/40 hover:bg-rose-900 text-rose-300 text-xs font-semibold rounded-lg border border-rose-800/40 transition-colors"
                        >
                          Revoke VIP
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 2: AUDIT LEDGER */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📜</span>
            <span>Points Transaction Audit Ledger ({filteredTransactions.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Filter Event Type:</label>
            <select
              value={txTypeFilter}
              onChange={(e) => setTxTypeFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
            >
              <option value="">All Event Types</option>
              <option value="WELCOME_BONUS">WELCOME_BONUS</option>
              <option value="DAILY_REWARD">DAILY_REWARD</option>
              <option value="REFERRAL">REFERRAL</option>
              <option value="CHAT_EARNING">CHAT_EARNING</option>
              <option value="PACKAGE_PURCHASE">PACKAGE_PURCHASE</option>
              <option value="VIP_PURCHASE">VIP_PURCHASE</option>
              <option value="PROMO_CODE">PROMO_CODE</option>
              <option value="SAVE_PARTNER">SAVE_PARTNER</option>
              <option value="RECONNECT">RECONNECT</option>
              <option value="ADMIN_ADJUSTMENT">ADMIN_ADJUSTMENT</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Event Type</th>
                  <th className="px-6 py-4">Points Delta</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      Loading transactions...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No points transactions recorded matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-white">
                        {tx.user.firstName}
                        <div className="text-[10px] text-slate-500 font-mono">
                          ID: {tx.user.telegramUserId}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-800 text-slate-300">
                          {tx.type}
                        </span>
                      </td>
                      <td
                        className={`px-6 py-4 font-bold text-sm ${
                          tx.amount >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} pts
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {tx.description || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Grant VIP Modal */}
      {grantModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>👑</span>
                <span>Grant VIP Access</span>
              </h3>
              <button
                onClick={() => setGrantModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1">
                  Select User *
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none"
                >
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.username ? `(@${u.username})` : ""} [ID: {u.telegramUserId}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1">
                  Plan Label / Description
                </label>
                <input
                  type="text"
                  value={planLabel}
                  onChange={(e) => setPlanLabel(e.target.value)}
                  placeholder="e.g. 1 Month VIP Pass"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1">
                  Duration (Days) *
                </label>
                <input
                  type="number"
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setGrantModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleGrantVip}
                disabled={granting}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-amber-600/30"
              >
                {granting ? "Granting..." : "Grant VIP Membership"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VipLedgerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px] text-slate-400">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading VIP ledger...</span>
          </div>
        </div>
      }
    >
      <VipLedgerContent />
    </Suspense>
  );
}
