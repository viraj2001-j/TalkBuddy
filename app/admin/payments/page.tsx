"use client";

import { useEffect, useState } from "react";

interface VipPackage {
  id: string;
  key: string;
  name: string;
  description: string | null;
  durationDays: number;
  pointsCost: number;
  starsPrice: number;
  priceUsd: number;
  badge: string | null;
  features: string | null;
  isActive: boolean;
  _count?: { payments: number; subscriptions: number };
}

interface PointsPackage {
  id: string;
  name: string;
  description: string | null;
  points: number;
  priceUsd: number;
  starsPrice: number;
  badge: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { payments: number };
}

interface PaymentTransaction {
  id: string;
  userId: string;
  orderType: string;
  pointsAmount: number;
  starsAmount: number | null;
  amountPaid: number;
  currency: string;
  provider: string;
  telegramPaymentChargeId: string | null;
  orderPayload: string | null;
  status: string;
  description: string | null;
  createdAt: string;
  user: {
    id: string;
    telegramUserId: string;
    firstName: string;
    username: string | null;
    pointsBalance: number;
  };
  package?: {
    id: string;
    name: string;
    points: number;
    starsPrice: number;
  } | null;
  vipPackage?: {
    id: string;
    key: string;
    name: string;
    durationDays: number;
    starsPrice: number;
  } | null;
  vipSubscription?: {
    id: string;
    status: string;
    startedAt: string;
    expiresAt: string;
  } | null;
}

export default function PaymentsManagementPage() {
  const [pointsPackages, setPointsPackages] = useState<PointsPackage[]>([]);
  const [vipPackages, setVipPackages] = useState<VipPackage[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [metrics, setMetrics] = useState<any>({
    totalTransactions: 0,
    completedCount: 0,
    pendingCount: 0,
    refundedCount: 0,
    failedCount: 0,
    grossStarsReceived: 0,
    refundedStars: 0,
    netStarsRetained: 0,
    grossUsdVolume: 0,
    activeVipSubscriptions: 0,
    expiredVipSubscriptions: 0,
  });

  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [currencyFilter, setCurrencyFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // VIP Package Modal
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [editingVipPkg, setEditingVipPkg] = useState<VipPackage | null>(null);
  const [vipKey, setVipKey] = useState("");
  const [vipName, setVipName] = useState("");
  const [vipDesc, setVipDesc] = useState("");
  const [vipDuration, setVipDuration] = useState(30);
  const [vipPointsCost, setVipPointsCost] = useState(250);
  const [vipStarsPrice, setVipStarsPrice] = useState(150);
  const [vipBadge, setVipBadge] = useState("");
  const [vipActive, setVipActive] = useState(true);
  const [savingVip, setSavingVip] = useState(false);

  // Points Package Modal
  const [pkgModalOpen, setPkgModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PointsPackage | null>(null);
  const [pkgName, setPkgName] = useState("");
  const [pkgDesc, setPkgDesc] = useState("");
  const [pkgPoints, setPkgPoints] = useState(100);
  const [pkgStars, setPkgStars] = useState(50);
  const [pkgUsd, setPkgUsd] = useState(0.99);
  const [pkgBadge, setPkgBadge] = useState("");
  const [pkgActive, setPkgActive] = useState(true);
  const [savingPkg, setSavingPkg] = useState(false);

  // Refund Modal
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedTxForRefund, setSelectedTxForRefund] = useState<PaymentTransaction | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    fetchPaymentsData();
  }, [statusFilter, currencyFilter]);

  async function fetchPaymentsData() {
    try {
      setLoading(true);
      const url = new URL("/api/admin/payments", window.location.origin);
      if (statusFilter) url.searchParams.set("status", statusFilter);
      if (currencyFilter) url.searchParams.set("currency", currencyFilter);
      if (searchQuery) url.searchParams.set("search", searchQuery);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setPointsPackages(data.packages || []);
        setVipPackages(data.vipPackages || []);
        setTransactions(data.transactions || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (err) {
      console.error("Fetch payments error:", err);
    } finally {
      setLoading(false);
    }
  }

  // Handle VIP Package Save
  async function handleSaveVipPackage() {
    try {
      setSavingVip(true);
      const payload = {
        action: editingVipPkg ? "update_vip_package" : "create_vip_package",
        vipPackageId: editingVipPkg?.id,
        key: vipKey,
        name: vipName,
        description: vipDesc,
        durationDays: vipDuration,
        pointsCost: vipPointsCost,
        starsPrice: vipStarsPrice,
        badge: vipBadge,
        isActive: vipActive,
      };

      const res = await fetch("/api/admin/payments", {
        method: editingVipPkg ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setVipModalOpen(false);
        fetchPaymentsData();
      } else {
        alert("Error: " + data.error);
      }
    } catch (err: any) {
      alert("Error saving VIP package: " + err.message);
    } finally {
      setSavingVip(false);
    }
  }

  // Handle Points Package Save
  async function handleSavePointsPackage() {
    try {
      setSavingPkg(true);
      const payload = {
        action: editingPkg ? "update_package" : "create_package",
        packageId: editingPkg?.id,
        name: pkgName,
        description: pkgDesc,
        points: pkgPoints,
        starsPrice: pkgStars,
        priceUsd: pkgUsd,
        badge: pkgBadge,
        isActive: pkgActive,
      };

      const res = await fetch("/api/admin/payments", {
        method: editingPkg ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setPkgModalOpen(false);
        fetchPaymentsData();
      } else {
        alert("Error: " + data.error);
      }
    } catch (err: any) {
      alert("Error saving package: " + err.message);
    } finally {
      setSavingPkg(false);
    }
  }

  // Handle Stars Refund Action
  async function handleExecuteRefund() {
    if (!selectedTxForRefund) return;
    try {
      setRefunding(true);
      const res = await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refund_transaction",
          transactionId: selectedTxForRefund.id,
          reason: refundReason || "Admin issued refund",
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert("Refund completed successfully! VIP and balance updated.");
        setRefundModalOpen(false);
        setSelectedTxForRefund(null);
        setRefundReason("");
        fetchPaymentsData();
      } else {
        alert("Refund failed: " + data.error);
      }
    } catch (err: any) {
      alert("Refund error: " + err.message);
    } finally {
      setRefunding(false);
    }
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>💳 VIP Packages & Financial Reporting</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Complete Telegram Stars (XTR) accounting, VIP package management, transaction reconciliation, and safe refunds.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingVipPkg(null);
              setVipKey("");
              setVipName("");
              setVipDesc("");
              setVipDuration(30);
              setVipPointsCost(250);
              setVipStarsPrice(150);
              setVipBadge("Best Value");
              setVipActive(true);
              setVipModalOpen(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-amber-600/30 flex items-center gap-2"
          >
            👑 New VIP Package
          </button>
          <button
            onClick={() => {
              setEditingPkg(null);
              setPkgName("");
              setPkgDesc("");
              setPkgPoints(100);
              setPkgStars(50);
              setPkgUsd(0.99);
              setPkgBadge("Starter");
              setPkgActive(true);
              setPkgModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
          >
            ⚡ New Points Package
          </button>
          <button
            onClick={fetchPaymentsData}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Financial Health Banner */}
      <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/20 text-xs text-amber-200 flex items-center gap-3">
        <span className="text-lg">⭐</span>
        <div>
          <b>Telegram Stars Accounting Policy:</b> Telegram Stars (<code className="text-amber-300 font-mono">XTR</code>) are digital in-app tokens debited by Telegram. They are tracked distinctly from internal Points and fiat cash. Never report Stars as cash revenue until settlement.
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Gross Stars */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
            ⭐ Gross Stars
          </span>
          <div className="text-2xl font-black text-amber-300 mt-1">
            ⭐ {metrics.grossStarsReceived.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">XTR gross received</p>
        </div>

        {/* Refunded Stars */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">
            ↩️ Refunded Stars
          </span>
          <div className="text-2xl font-black text-rose-300 mt-1">
            ⭐ {metrics.refundedStars.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">{metrics.refundedCount} refund(s)</p>
        </div>

        {/* Net Retained Stars */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
            💎 Net Retained
          </span>
          <div className="text-2xl font-black text-emerald-300 mt-1">
            ⭐ {metrics.netStarsRetained.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Net Stars in reserve</p>
        </div>

        {/* Active VIP Subscriptions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
            👑 Active VIPs
          </span>
          <div className="text-2xl font-black text-purple-300 mt-1">
            {metrics.activeVipSubscriptions.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Currently active</p>
        </div>

        {/* Expired Subscriptions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            ⏳ Expired VIPs
          </span>
          <div className="text-2xl font-black text-slate-300 mt-1">
            {metrics.expiredVipSubscriptions.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Expired/Revoked</p>
        </div>

        {/* Total Transactions */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
            🧾 Total Orders
          </span>
          <div className="text-2xl font-black text-blue-300 mt-1">
            {metrics.totalTransactions.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">{metrics.completedCount} completed</p>
        </div>
      </div>

      {/* SECTION 1: VIP PACKAGES CATALOG */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>👑 VIP Membership Packages ({vipPackages.length})</span>
          </h2>
          <span className="text-xs text-slate-400">
            Available in Telegram via <code>/vip</code> and Chat Links
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {vipPackages.map((pkg) => (
            <div
              key={pkg.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                pkg.isActive
                  ? "bg-slate-900 border-slate-800 hover:border-slate-700"
                  : "bg-slate-950/60 border-slate-900 opacity-60"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {pkg.badge || "VIP Plan"}
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${
                      pkg.isActive ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {pkg.isActive ? "● Active" : "○ Inactive"}
                  </span>
                </div>

                <h3 className="font-bold text-white text-base">{pkg.name}</h3>
                <div className="text-xs text-slate-400 mt-0.5">
                  Duration: <b className="text-white">{pkg.durationDays} Days</b>
                </div>

                <div className="my-3 space-y-1 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-xs font-semibold text-amber-300 flex items-center justify-between">
                    <span>Telegram Stars:</span>
                    <span className="font-bold">⭐ {pkg.starsPrice} XTR</span>
                  </div>
                  <div className="text-xs font-semibold text-indigo-300 flex items-center justify-between">
                    <span>Points Cost:</span>
                    <span className="font-bold">💎 {pkg.pointsCost} pts</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2">
                  {pkg.description || "Full VIP perks access."}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 mt-3 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">
                  Subs: {pkg._count?.subscriptions ?? 0}
                </span>
                <button
                  onClick={() => {
                    setEditingVipPkg(pkg);
                    setVipKey(pkg.key);
                    setVipName(pkg.name);
                    setVipDesc(pkg.description || "");
                    setVipDuration(pkg.durationDays);
                    setVipPointsCost(pkg.pointsCost);
                    setVipStarsPrice(pkg.starsPrice);
                    setVipBadge(pkg.badge || "");
                    setVipActive(pkg.isActive);
                    setVipModalOpen(true);
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700"
                >
                  ✏️ Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: POINTS PACKAGES CATALOG */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>⚡ Points Top-up Packages ({pointsPackages.length})</span>
          </h2>
          <span className="text-xs text-slate-400">
            Available in Telegram via <code>/earn</code>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {pointsPackages.map((pkg) => (
            <div
              key={pkg.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                pkg.isActive
                  ? "bg-slate-900 border-slate-800 hover:border-slate-700"
                  : "bg-slate-950/60 border-slate-900 opacity-60"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {pkg.badge || "Points"}
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${
                      pkg.isActive ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {pkg.isActive ? "● Active" : "○ Inactive"}
                  </span>
                </div>

                <h3 className="font-bold text-white text-base">{pkg.name}</h3>
                <div className="text-xl font-extrabold text-indigo-300 my-1">
                  +{pkg.points.toLocaleString()} <span className="text-xs text-slate-400 font-normal">pts</span>
                </div>
                <div className="text-xs font-semibold text-slate-300">
                  ⭐ {pkg.starsPrice} Stars <span className="text-slate-500">(${pkg.priceUsd} USD)</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 mt-3 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">
                  Sales: {pkg._count?.payments ?? 0}
                </span>
                <button
                  onClick={() => {
                    setEditingPkg(pkg);
                    setPkgName(pkg.name);
                    setPkgDesc(pkg.description || "");
                    setPkgPoints(pkg.points);
                    setPkgStars(pkg.starsPrice);
                    setPkgUsd(pkg.priceUsd);
                    setPkgBadge(pkg.badge || "");
                    setPkgActive(pkg.isActive);
                    setPkgModalOpen(true);
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700"
                >
                  ✏️ Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: AUDITED TRANSACTIONS LOG */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🧾 Financial Transactions & Invoices Log</span>
            </h2>
            <p className="text-xs text-slate-400">
              Verified records with Telegram Charge IDs and automatic subscription fulfillment status.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="REFUNDED">REFUNDED</option>
              <option value="PENDING">PENDING</option>
              <option value="FAILED">FAILED</option>
            </select>

            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
            >
              <option value="">All Currencies</option>
              <option value="XTR">⭐ Stars (XTR)</option>
              <option value="POINTS">💎 Points</option>
              <option value="USD">💵 USD</option>
            </select>

            <input
              type="text"
              placeholder="Search user, charge ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchPaymentsData()}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none w-48"
            />
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Purchase ID</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Item / Plan</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Currency</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">VIP Expiration</th>
                  <th className="py-3 px-4">Telegram Charge Ref</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      No financial transactions match the selected criteria.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const itemName =
                      t.vipPackage?.name ||
                      t.package?.name ||
                      (t.orderType === "VIP_SUBSCRIPTION" ? "VIP Membership" : "Points Top-up");

                    const amountDisplay =
                      t.currency === "XTR"
                        ? `⭐ ${t.starsAmount ?? t.amountPaid}`
                        : t.currency === "POINTS"
                        ? `💎 ${t.pointsAmount}`
                        : `$${t.amountPaid.toFixed(2)}`;

                    const isRefundable =
                      t.status === "COMPLETED" && t.currency === "XTR" && Boolean(t.telegramPaymentChargeId);

                    return (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                          {t.id.substring(0, 8)}...
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{t.user.firstName}</div>
                          <div className="text-[10px] text-slate-500">
                            ID: {t.user.telegramUserId}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-200">{itemName}</span>
                          <span className="block text-[10px] text-slate-500 font-mono">
                            {t.orderType}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-white">
                          {amountDisplay}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.currency === "XTR"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : t.currency === "POINTS"
                                ? "bg-indigo-500/20 text-indigo-300"
                                : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            {t.currency}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.status === "COMPLETED"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : t.status === "REFUNDED"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : t.status === "PENDING"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-[11px]">
                          {t.vipSubscription?.expiresAt ? (
                            <span className="text-purple-300 font-medium">
                              {new Date(t.vipSubscription.expiresAt).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[10px] text-slate-400">
                          {t.telegramPaymentChargeId ? (
                            <span title={t.telegramPaymentChargeId}>
                              {t.telegramPaymentChargeId.substring(0, 14)}...
                            </span>
                          ) : (
                            <span className="text-slate-600">None</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isRefundable && (
                            <button
                              onClick={() => {
                                setSelectedTxForRefund(t);
                                setRefundReason("");
                                setRefundModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-[11px] font-semibold rounded-lg transition-colors"
                            >
                              ↩️ Refund Stars
                            </button>
                          )}
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

      {/* MODAL 1: VIP PACKAGE EDIT/CREATE */}
      {vipModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              {editingVipPkg ? "Edit VIP Package" : "Create New VIP Package"}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Package Key (Unique, e.g. 1w, 1m, 3m)</label>
                <input
                  type="text"
                  value={vipKey}
                  disabled={Boolean(editingVipPkg)}
                  onChange={(e) => setVipKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Package Name</label>
                <input
                  type="text"
                  value={vipName}
                  onChange={(e) => setVipName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Duration (Days)</label>
                  <input
                    type="number"
                    value={vipDuration}
                    onChange={(e) => setVipDuration(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Badge</label>
                  <input
                    type="text"
                    value={vipBadge}
                    onChange={(e) => setVipBadge(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-amber-400 block mb-1 font-semibold">Stars Price (XTR)</label>
                  <input
                    type="number"
                    value={vipStarsPrice}
                    onChange={(e) => setVipStarsPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-amber-500/30 rounded-xl px-3 py-2 text-amber-300 font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-indigo-400 block mb-1 font-semibold">Points Cost</label>
                  <input
                    type="number"
                    value={vipPointsCost}
                    onChange={(e) => setVipPointsCost(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-indigo-500/30 rounded-xl px-3 py-2 text-indigo-300 font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={vipDesc}
                  onChange={(e) => setVipDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="vipActive"
                  checked={vipActive}
                  onChange={(e) => setVipActive(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-amber-500"
                />
                <label htmlFor="vipActive" className="text-slate-300 text-xs font-semibold">
                  Active (Visible to users)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setVipModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={savingVip}
                onClick={handleSaveVipPackage}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold"
              >
                {savingVip ? "Saving..." : "Save Package"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: POINTS PACKAGE EDIT/CREATE */}
      {pkgModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              {editingPkg ? "Edit Points Package" : "Create New Points Package"}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Package Name</label>
                <input
                  type="text"
                  value={pkgName}
                  onChange={(e) => setPkgName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-indigo-400 block mb-1 font-semibold">Points Credited</label>
                  <input
                    type="number"
                    value={pkgPoints}
                    onChange={(e) => setPkgPoints(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-indigo-500/30 rounded-xl px-3 py-2 text-indigo-300 font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-amber-400 block mb-1 font-semibold">Stars Price (XTR)</label>
                  <input
                    type="number"
                    value={pkgStars}
                    onChange={(e) => setPkgStars(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-amber-500/30 rounded-xl px-3 py-2 text-amber-300 font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Badge</label>
                <input
                  type="text"
                  value={pkgBadge}
                  onChange={(e) => setPkgBadge(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={pkgDesc}
                  onChange={(e) => setPkgDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pkgActive"
                  checked={pkgActive}
                  onChange={(e) => setPkgActive(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-indigo-500"
                />
                <label htmlFor="pkgActive" className="text-slate-300 text-xs font-semibold">
                  Active (Visible to users)
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setPkgModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={savingPkg}
                onClick={handleSavePointsPackage}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
              >
                {savingPkg ? "Saving..." : "Save Package"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EXECUTE TELEGRAM STARS REFUND */}
      {refundModalOpen && selectedTxForRefund && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-800/60 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-rose-400 flex items-center gap-2">
              <span>⚠️ Issue Telegram Stars Refund</span>
            </h3>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
              <div><b>User:</b> {selectedTxForRefund.user.firstName} (ID: {selectedTxForRefund.user.telegramUserId})</div>
              <div><b>Amount:</b> ⭐ {selectedTxForRefund.starsAmount} Stars (XTR)</div>
              <div><b>Charge ID:</b> <code className="text-amber-300">{selectedTxForRefund.telegramPaymentChargeId}</code></div>
              <div><b>Action:</b> Will call Telegram Bot API <code>refundStarPayment</code>, revoke active VIP or deduct credited points, and update status to REFUNDED.</div>
            </div>

            <div>
              <label className="text-slate-400 block text-xs mb-1">Reason for Refund</label>
              <input
                type="text"
                placeholder="e.g. Accidental purchase / user request"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setRefundModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={refunding}
                onClick={handleExecuteRefund}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
              >
                {refunding ? "Processing Refund..." : "Confirm Stars Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
