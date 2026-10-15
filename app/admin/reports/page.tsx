"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface ReportItem {
  id: string;
  reporterId: string;
  reportedUserId: string;
  chatSessionId: string | null;
  reason: string;
  details: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  reporter: {
    id: string;
    telegramUserId: string;
    username: string | null;
    firstName: string;
  };
  reportedUser: {
    id: string;
    telegramUserId: string;
    username: string | null;
    firstName: string;
    isBanned: boolean;
    banReason: string | null;
    pointsBalance: number;
  };
  chatSession: {
    id: string;
    status: string;
    startedAt: string;
  } | null;
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, banned: 0, dismissed: 0 });
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  // Ban Modal
  const [banModal, setBanModal] = useState<{ open: boolean; report: ReportItem | null }>({
    open: false,
    report: null,
  });
  const [banReason, setBanReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchReports();
  }, [filter]);

  function showToast(text: string, type: "success" | "error" = "success") {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  }

  async function fetchReports() {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/reports?status=${filter}`);
      const data = await res.json();
      if (data.success) {
        setReports(data.reports || []);
        setStats(data.stats || { total: 0, pending: 0, banned: 0, dismissed: 0 });
      }
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDismiss(reportId: string) {
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, action: "DISMISS" }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Report marked as dismissed.");
        fetchReports();
      } else {
        showToast(data.error || "Failed to dismiss report.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    }
  }

  async function handleConfirmBan(e: React.FormEvent) {
    e.preventDefault();
    if (!banModal.report) return;

    try {
      setProcessing(true);
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: banModal.report.id,
          action: "BAN_USER",
          banReason: banReason || banModal.report.reason,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast("User suspended and report resolved.");
        setBanModal({ open: false, report: null });
        setBanReason("");
        fetchReports();
      } else {
        showToast(data.error || "Failed to ban user.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    } finally {
      setProcessing(false);
    }
  }

  async function handleDelete(reportId: string) {
    if (!confirm("Are you sure you want to delete this report record?")) return;
    try {
      const res = await fetch(`/api/admin/reports?id=${reportId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showToast("Report deleted.");
        fetchReports();
      } else {
        showToast("Failed to delete report.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    }
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-medium ${
            notification.type === "success"
              ? "bg-emerald-950/90 text-emerald-200 border-emerald-800"
              : "bg-rose-950/90 text-rose-200 border-rose-800"
          }`}
        >
          <span>{notification.type === "success" ? "✅" : "❌"}</span>
          <span>{notification.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>🚨</span> Abuse Reports & Moderation
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Review partner abuse reports, take moderation actions, and suspend offending accounts.
          </p>
        </div>
        <button
          onClick={fetchReports}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition flex items-center gap-2"
        >
          <span>↻</span> Refresh Reports
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Pending Review</span>
          <p className="text-3xl font-bold text-amber-400 mt-1">{stats.pending}</p>
          <span className="text-xs text-amber-500/80 mt-2 block">Awaiting admin investigation</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Banned Offenders</span>
          <p className="text-3xl font-bold text-rose-400 mt-1">{stats.banned}</p>
          <span className="text-xs text-rose-500/80 mt-2 block">Actioned via abuse reports</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Dismissed Reports</span>
          <p className="text-3xl font-bold text-slate-400 mt-1">{stats.dismissed}</p>
          <span className="text-xs text-slate-500 mt-2 block">Verified as non-violating</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Reports</span>
          <p className="text-3xl font-bold text-indigo-400 mt-1">{stats.total}</p>
          <span className="text-xs text-slate-400 mt-2 block">All-time reported incidents</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        {[
          { id: "ALL", label: "All Reports" },
          { id: "PENDING", label: `Pending (${stats.pending})` },
          { id: "RESOLVED_BANNED", label: `Banned (${stats.banned})` },
          { id: "DISMISSED", label: `Dismissed (${stats.dismissed})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              filter === tab.id
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reports Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No reports found for this filter. The community is clean!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/50 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-6">Reported User</th>
                  <th className="py-3.5 px-6">Reporter</th>
                  <th className="py-3.5 px-6">Reason & Incident</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Date</th>
                  <th className="py-3.5 px-6 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{r.reportedUser.firstName}</span>
                        {r.reportedUser.username && (
                          <span className="text-xs text-indigo-400">@{r.reportedUser.username}</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        TG: {r.reportedUser.telegramUserId}
                      </div>
                      <div className="mt-1">
                        {r.reportedUser.isBanned ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            🚫 BANNED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ACTIVE ({r.reportedUser.pointsBalance} pts)
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="text-slate-200">{r.reporter.firstName}</div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        TG: {r.reporter.telegramUserId}
                      </div>
                    </td>

                    <td className="py-4 px-6 max-w-xs">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20 inline-block mb-1">
                        {r.reason}
                      </span>
                      {r.adminNotes && (
                        <div className="text-xs text-slate-400 italic">Notes: {r.adminNotes}</div>
                      )}
                      {r.chatSessionId && (
                        <div className="mt-1">
                          <Link
                            href={`/admin/chats`}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
                          >
                            💬 Inspect Chat Session
                          </Link>
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-6">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          r.status === "PENDING"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : r.status === "RESOLVED_BANNED"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {r.status.replace("_", " ")}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-xs text-slate-400">
                      {new Date(r.createdAt).toLocaleDateString()} {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="py-4 px-6 text-right space-x-2">
                      {!r.reportedUser.isBanned && r.status === "PENDING" && (
                        <button
                          onClick={() => {
                            setBanModal({ open: true, report: r });
                            setBanReason(r.reason);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md shadow-rose-600/20 transition"
                        >
                          🚫 Ban Offender
                        </button>
                      )}
                      {r.status === "PENDING" && (
                        <button
                          onClick={() => handleDismiss(r.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
                        >
                          ✓ Dismiss
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ban Offender Modal */}
      {banModal.open && banModal.report && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🚫</span> Suspend User Account
              </h3>
              <button
                onClick={() => setBanModal({ open: false, report: null })}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              You are banning <strong>{banModal.report.reportedUser.firstName}</strong> (TG:{" "}
              <code className="text-indigo-400">{banModal.report.reportedUser.telegramUserId}</code>).
              This will instantly terminate all their active chats, remove them from queue, and block
              their bot access.
            </p>

            <form onSubmit={handleConfirmBan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                  Ban Reason
                </label>
                <textarea
                  required
                  rows={3}
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBanModal({ open: false, report: null })}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition disabled:opacity-50"
                >
                  {processing ? "Suspending..." : "Confirm Ban & Resolve"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
