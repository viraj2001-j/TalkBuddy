"use client";

import { useEffect, useState } from "react";

interface QueueUser {
  id: string;
  telegramUserId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  gender: string;
  isVip: boolean;
  activeVipPlan: string | null;
  pointsBalance: number;
}

interface QueueItem {
  id: string;
  userId: string;
  partnerUserId: string | null;
  status: string;
  joinedAt: string;
  user: QueueUser;
}

export default function QueueMonitorPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual Matching
  const [selectedUserOne, setSelectedUserOne] = useState<string>("");
  const [selectedUserTwo, setSelectedUserTwo] = useState<string>("");
  const [matching, setMatching] = useState(false);

  useEffect(() => {
    fetchQueue();
  }, []);

  async function fetchQueue() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/queue");
      const data = await res.json();
      if (data.success) {
        setQueue(data.queue || []);
        if (data.queue.length >= 2) {
          setSelectedUserOne(data.queue[0].userId);
          setSelectedUserTwo(data.queue[1].userId);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleForceMatch() {
    if (!selectedUserOne || !selectedUserTwo) {
      alert("Please select two users to pair");
      return;
    }
    if (selectedUserOne === selectedUserTwo) {
      alert("You cannot pair a user with themselves");
      return;
    }

    try {
      setMatching(true);
      const res = await fetch("/api/admin/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userOneId: selectedUserOne,
          userTwoId: selectedUserTwo,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ Match successfully created! Users are now in an active live chat.");
        fetchQueue();
      } else {
        alert("Failed to force match: " + data.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setMatching(false);
    }
  }

  async function handleRemoveFromQueue(userId: string) {
    if (!confirm("Remove this user from the waiting queue?")) return;
    try {
      const res = await fetch(`/api/admin/queue?userId=${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        fetchQueue();
      } else {
        alert("Error: " + data.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Matching Queue Monitor & Pair Engine
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time pool of users searching for partners. View wait times, force manual matches, or remove users.
          </p>
        </div>
        <button
          onClick={fetchQueue}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-medium rounded-xl transition-colors border border-slate-700 flex items-center gap-2"
        >
          🔄 Refresh Queue
        </button>
      </div>

      {/* Manual Matching Card */}
      {queue.length >= 2 && (
        <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                ⚡ Force Manual Pair Match
              </h2>
              <p className="text-xs text-slate-400">
                Instantly connect any two waiting users into an active private chat session.
              </p>
            </div>
            <button
              onClick={handleForceMatch}
              disabled={matching}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/30"
            >
              {matching ? "Connecting..." : "🚀 Match Pair Now"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-xs font-semibold mb-1">
                Select First User
              </label>
              <select
                value={selectedUserOne}
                onChange={(e) => setSelectedUserOne(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
              >
                {queue.map((item) => (
                  <option key={item.id} value={item.user.id}>
                    {item.user.firstName} ({item.user.gender}) — Balance: {item.user.pointsBalance} pts
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-semibold mb-1">
                Select Second User (Partner)
              </label>
              <select
                value={selectedUserTwo}
                onChange={(e) => setSelectedUserTwo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
              >
                {queue.map((item) => (
                  <option key={item.id} value={item.user.id}>
                    {item.user.firstName} ({item.user.gender}) — Balance: {item.user.pointsBalance} pts
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Queue Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Telegram ID</th>
                <th className="px-6 py-4">Gender</th>
                <th className="px-6 py-4">VIP Status</th>
                <th className="px-6 py-4">Points</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Joined At</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500 animate-pulse">
                    Loading queue pool...
                  </td>
                </tr>
              ) : queue.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    No users currently waiting in queue.
                  </td>
                </tr>
              ) : (
                queue.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">
                        {item.user.firstName} {item.user.lastName || ""}
                      </div>
                      {item.user.username && (
                        <div className="text-xs text-indigo-400">@{item.user.username}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">
                      {item.user.telegramUserId}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium">
                      <span className="px-2.5 py-1 rounded-full bg-slate-800">
                        {item.user.gender}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {item.user.isVip ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-800">
                          👑 VIP
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Free User</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-indigo-300">
                      💰 {item.user.pointsBalance}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-950 text-sky-300 border border-sky-800 animate-pulse">
                        ● {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                      {new Date(item.joinedAt).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRemoveFromQueue(item.user.id)}
                        className="px-3 py-1 bg-rose-950/40 hover:bg-rose-900 text-rose-300 text-xs font-semibold rounded-lg border border-rose-800/40 transition-colors"
                      >
                        Cancel / Kick
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
  );
}
