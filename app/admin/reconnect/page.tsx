"use client";

import React, { useState, useEffect } from "react";

interface ReconnectItem {
  id: string;
  senderId: string;
  receiverId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    telegramUserId: string;
    username: string | null;
    firstName: string;
  };
  receiver: {
    id: string;
    telegramUserId: string;
    username: string | null;
    firstName: string;
  };
}

export default function AdminReconnectPage() {
  const [requests, setRequests] = useState<ReconnectItem[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, accepted: 0, declined: 0, cancelled: 0 });
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  function showToast(text: string, type: "success" | "error" = "success") {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  }

  async function fetchRequests() {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/reconnect?status=${filter}`);
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
        setStats(data.stats || { total: 0, pending: 0, accepted: 0, declined: 0, cancelled: 0 });
      }
    } catch (err) {
      console.error("Failed to fetch reconnect requests:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateStatus(requestId: string, status: string) {
    try {
      const res = await fetch("/api/admin/reconnect", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Request marked as ${status}.`);
        fetchRequests();
      } else {
        showToast(data.error || "Failed to update status.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    }
  }

  async function handleDelete(requestId: string) {
    if (!confirm("Are you sure you want to delete this reconnect request?")) return;
    try {
      const res = await fetch(`/api/admin/reconnect?id=${requestId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        showToast("Request deleted.");
        fetchRequests();
      } else {
        showToast("Failed to delete request.", "error");
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
            <span>🔄</span> Reconnect Requests Manager
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Monitor partner reconnect invitations, inspect statuses, and manage pending reconnection attempts.
          </p>
        </div>
        <button
          onClick={fetchRequests}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition flex items-center gap-2"
        >
          <span>↻</span> Refresh Requests
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Pending</span>
          <p className="text-3xl font-bold text-amber-400 mt-1">{stats.pending}</p>
          <span className="text-xs text-amber-500/80 mt-2 block">Awaiting partner response</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Accepted</span>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{stats.accepted}</p>
          <span className="text-xs text-emerald-500/80 mt-2 block">Successfully reconnected</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Declined</span>
          <p className="text-3xl font-bold text-slate-400 mt-1">{stats.declined}</p>
          <span className="text-xs text-slate-500 mt-2 block">Declined by partner</span>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Cancelled</span>
          <p className="text-3xl font-bold text-rose-400 mt-1">{stats.cancelled}</p>
          <span className="text-xs text-rose-500/80 mt-2 block">Auto or sender cancelled</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        {[
          { id: "ALL", label: `All (${stats.total})` },
          { id: "PENDING", label: `Pending (${stats.pending})` },
          { id: "ACCEPTED", label: `Accepted (${stats.accepted})` },
          { id: "DECLINED", label: `Declined (${stats.declined})` },
          { id: "CANCELLED", label: `Cancelled (${stats.cancelled})` },
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

      {/* Requests Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading reconnect requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No reconnect requests matching this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/50 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-6">Sender User</th>
                  <th className="py-3.5 px-6">Target Receiver</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Requested At</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{r.sender.firstName}</span>
                        {r.sender.username && (
                          <span className="text-xs text-indigo-400">@{r.sender.username}</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        TG: {r.sender.telegramUserId}
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{r.receiver.firstName}</span>
                        {r.receiver.username && (
                          <span className="text-xs text-indigo-400">@{r.receiver.username}</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        TG: {r.receiver.telegramUserId}
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          r.status === "PENDING"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : r.status === "ACCEPTED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : r.status === "DECLINED"
                            ? "bg-slate-800 text-slate-400 border border-slate-700"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-xs text-slate-400">
                      {new Date(r.createdAt).toLocaleDateString()} {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="py-4 px-6 text-right space-x-2">
                      {r.status === "PENDING" && (
                        <button
                          onClick={() => handleUpdateStatus(r.id, "CANCELLED")}
                          className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 font-semibold text-xs transition border border-rose-800/40"
                        >
                          Cancel
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
    </div>
  );
}
