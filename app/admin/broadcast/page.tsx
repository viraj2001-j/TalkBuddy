"use client";

import React, { useState, useEffect } from "react";

interface BroadcastItem {
  id: string;
  title: string;
  message: string;
  targetAudience: string;
  buttonText: string | null;
  buttonUrl: string | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  status: string;
  createdAt: string;
}

interface AudienceStats {
  all: number;
  vip: number;
  activeToday: number;
}

export default function AdminBroadcastPage() {
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [audienceStats, setAudienceStats] = useState<AudienceStats>({ all: 0, vip: 0, activeToday: 0 });
  const [stats, setStats] = useState({ totalBroadcasts: 0, totalSent: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: "",
    message: "",
    targetAudience: "ALL",
    buttonText: "",
    buttonUrl: "",
  });

  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  async function fetchBroadcasts() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/broadcast");
      const data = await res.json();
      if (data.success) {
        setBroadcasts(data.broadcasts || []);
        setAudienceStats(data.audienceStats || { all: 0, vip: 0, activeToday: 0 });
        setStats(data.stats || { totalBroadcasts: 0, totalSent: 0 });
      }
    } catch (err) {
      console.error("Failed to load broadcasts:", err);
    } finally {
      setLoading(false);
    }
  }

  function showToast(text: string, type: "success" | "error" = "success") {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) {
      showToast("Title and message are required.", "error");
      return;
    }

    try {
      setSending(true);
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (data.success) {
        showToast("Broadcast campaign sent successfully!");
        setShowModal(false);
        setForm({
          title: "",
          message: "",
          targetAudience: "ALL",
          buttonText: "",
          buttonUrl: "",
        });
        fetchBroadcasts();
      } else {
        showToast(data.error || "Failed to send broadcast.", "error");
      }
    } catch {
      showToast("Network error while sending broadcast.", "error");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this broadcast log?")) return;
    try {
      const res = await fetch(`/api/admin/broadcast?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showToast("Broadcast deleted.");
        fetchBroadcasts();
      } else {
        showToast("Failed to delete broadcast.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    }
  }

  const targetCount =
    form.targetAudience === "VIP_ONLY"
      ? audienceStats.vip
      : form.targetAudience === "ACTIVE_TODAY"
      ? audienceStats.activeToday
      : audienceStats.all;

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
            <span>📢</span> Push Broadcast & Announcements
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Send instant alerts, promotional bonuses, and community announcements to Telegram users.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
        >
          <span>✨</span> Create Broadcast
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Campaigns</span>
          <p className="text-3xl font-bold text-white mt-1">{stats.totalBroadcasts}</p>
          <span className="text-xs text-indigo-400 mt-2 block">All-time campaigns</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Messages Delivered</span>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{stats.totalSent}</p>
          <span className="text-xs text-emerald-500/80 mt-2 block">Directly delivered to bot users</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Targetable Users</span>
          <p className="text-3xl font-bold text-indigo-400 mt-1">{audienceStats.all}</p>
          <span className="text-xs text-slate-400 mt-2 block">Active non-banned Telegram profiles</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">VIP Subscribers</span>
          <p className="text-3xl font-bold text-amber-400 mt-1">{audienceStats.vip}</p>
          <span className="text-xs text-amber-400/80 mt-2 block">Premium VIP member segment</span>
        </div>
      </div>

      {/* Broadcast History Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-white">Broadcast Campaign History</h2>
            <p className="text-xs text-slate-400 mt-0.5">Audit log of all sent notifications and deliveries</p>
          </div>
          <button
            onClick={fetchBroadcasts}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading broadcast history...</div>
        ) : broadcasts.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No broadcast campaigns sent yet. Click &quot;Create Broadcast&quot; to send your first message!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/50 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-6">Campaign Title</th>
                  <th className="py-3.5 px-6">Audience</th>
                  <th className="py-3.5 px-6">Delivered / Total</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Date</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {broadcasts.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-white">{b.title}</div>
                      <div className="text-xs text-slate-400 line-clamp-1 max-w-sm">{b.message}</div>
                      {b.buttonText && b.buttonUrl && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-indigo-400 mt-1">
                          🔗 Button: {b.buttonText}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          b.targetAudience === "VIP_ONLY"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : b.targetAudience === "ACTIVE_TODAY"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {b.targetAudience.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-200">
                        {b.sentCount} / {b.totalRecipients}
                      </div>
                      {b.failedCount > 0 && (
                        <div className="text-xs text-rose-400">{b.failedCount} failed</div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {b.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-400">
                      {new Date(b.createdAt).toLocaleDateString()} {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleDelete(b.id)}
                        className="px-3 py-1.5 rounded-lg text-rose-400 hover:text-white hover:bg-rose-950/50 transition text-xs font-medium"
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

      {/* Create Broadcast Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>📢</span> Compose Broadcast Campaign
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Send immediate announcement to all or filtered Telegram bot users.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                  Campaign Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 🔥 Weekend Bonus: 2x Daily Points!"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                  Target Audience *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "ALL", label: "All Users", count: audienceStats.all },
                    { id: "ACTIVE_TODAY", label: "Active Today", count: audienceStats.activeToday },
                    { id: "VIP_ONLY", label: "VIP Only", count: audienceStats.vip },
                  ].map((aud) => (
                    <button
                      key={aud.id}
                      type="button"
                      onClick={() => setForm({ ...form, targetAudience: aud.id })}
                      className={`p-3 rounded-xl border text-left transition ${
                        form.targetAudience === aud.id
                          ? "bg-indigo-600/20 border-indigo-500 text-white"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="text-xs font-bold">{aud.label}</div>
                      <div className="text-[11px] text-slate-400 mt-1">{aud.count} recipients</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                  Message Content (HTML Supported) *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Write your announcement here. You can use <b>bold</b> and <i>italic</i> formatting."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                    Optional Button Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Claim Points Now"
                    value={form.buttonText}
                    onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                    Optional Button URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://t.me/talkbuddybot"
                    value={form.buttonUrl}
                    onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                <span className="text-xs text-slate-400">
                  Targeting <strong className="text-indigo-400">{targetCount}</strong> Telegram users
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-medium text-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                  >
                    {sending ? "Delivering..." : `🚀 Launch to ${targetCount} Users`}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
