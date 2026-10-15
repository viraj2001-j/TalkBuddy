"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  totalUsers: number;
  vipUsers: number;
  queueCount: number;
  activeSessions: number;
  totalMessages: number;
  mediaCount: number;
  totalPointsBalance: number;
  totalRevenueUsd: number;
  totalPaymentsCount: number;
  totalPointsSold: number;
  totalPackages: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      } else {
        setError(data.error || "Failed to load stats");
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              System Overview & Analytics
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live Production
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Real-time analytics, user metrics, points circulation, and revenue stats for TalkBuddy.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/payments"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
          >
            💳 Manage Payments & Points
          </Link>
          <button
            onClick={fetchStats}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-medium rounded-xl transition-colors flex items-center gap-2 border border-slate-700"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400 animate-pulse text-sm">
          Loading metrics data...
        </div>
      ) : error ? (
        <div className="bg-red-950/50 border border-red-800 text-red-200 p-4 rounded-xl text-sm flex items-center justify-between">
          <span>⚠️ Error loading stats: {error}</span>
          <button
            onClick={fetchStats}
            className="px-3 py-1 bg-red-900/60 hover:bg-red-800 rounded-lg text-xs font-medium"
          >
            Retry
          </button>
        </div>
      ) : stats ? (
        <>
          {/* Key Revenue & Points Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 space-y-2 shadow-sm hover:border-indigo-500/50 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                  Total Revenue
                </span>
                <span className="text-xl">💵</span>
              </div>
              <div className="text-3xl font-extrabold text-white">
                ${stats.totalRevenueUsd.toFixed(2)}
              </div>
              <p className="text-xs text-slate-400">
                {stats.totalPaymentsCount} successful transactions
              </p>
            </div>

            <div className="bg-gradient-to-br from-amber-950/60 to-slate-900 border border-amber-500/30 rounded-2xl p-6 space-y-2 shadow-sm hover:border-amber-500/50 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Points in Circulation
                </span>
                <span className="text-xl">💰</span>
              </div>
              <div className="text-3xl font-extrabold text-amber-300">
                {stats.totalPointsBalance.toLocaleString()} pts
              </div>
              <p className="text-xs text-slate-400">
                +{stats.totalPointsSold.toLocaleString()} pts purchased
              </p>
            </div>

            <div className="bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 space-y-2 shadow-sm hover:border-emerald-500/50 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Active Live Chats
                </span>
                <span className="text-xl">💬</span>
              </div>
              <div className="text-3xl font-extrabold text-emerald-300">
                {stats.activeSessions}
              </div>
              <p className="text-xs text-slate-400">Ongoing conversation pairs</p>
            </div>

            <div className="bg-gradient-to-br from-sky-950/60 to-slate-900 border border-sky-500/30 rounded-2xl p-6 space-y-2 shadow-sm hover:border-sky-500/50 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                  Waiting in Queue
                </span>
                <span className="text-xl">⏳</span>
              </div>
              <div className="text-3xl font-extrabold text-sky-300">
                {stats.queueCount}
              </div>
              <p className="text-xs text-slate-400">Searching for partner</p>
            </div>
          </div>

          {/* Secondary Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Registered Users
              </span>
              <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
              <p className="text-xs text-slate-500">Telegram accounts verified</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                Active VIP Subscribers
              </span>
              <div className="text-2xl font-bold text-amber-300">{stats.vipUsers}</div>
              <p className="text-xs text-slate-500">Members with active VIP pass</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Chat Messages
              </span>
              <div className="text-2xl font-bold text-white">{stats.totalMessages}</div>
              <p className="text-xs text-slate-500">Logged transcripts in DB</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Media Uploads & Packages
              </span>
              <div className="text-2xl font-bold text-white">
                {stats.mediaCount} media / {stats.totalPackages} packages
              </div>
              <p className="text-xs text-slate-500">R2 files stored</p>
            </div>
          </div>

          {/* Quick Actions & Module Navigation */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">System Operations & CRUD Panels</h2>
              <span className="text-xs text-slate-400">All features operational</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link
                href="/admin/users"
                className="p-5 bg-slate-950/80 hover:bg-slate-800/80 rounded-xl border border-slate-800 hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">👥</span>
                  <span className="font-bold text-white group-hover:text-indigo-400 transition-colors">
                    User Management
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Search users, adjust points, grant VIP, ban/unban, delete users, and view referral counts.
                </p>
              </Link>

              <Link
                href="/admin/payments"
                className="p-5 bg-slate-950/80 hover:bg-slate-800/80 rounded-xl border border-indigo-900/40 hover:border-indigo-600/60 transition-all group bg-gradient-to-r from-indigo-950/20 to-transparent"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">💳</span>
                  <span className="font-bold text-indigo-300 group-hover:text-white transition-colors">
                    Points & Payments CRUD
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Create and manage points packages, audit payments, issue refunds, or credit points directly.
                </p>
              </Link>

              <Link
                href="/admin/chats"
                className="p-5 bg-slate-950/80 hover:bg-slate-800/80 rounded-xl border border-slate-800 hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">💬</span>
                  <span className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                    Live Chat Monitor
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Inspect ongoing sessions, read live message transcripts, and force terminate active chats.
                </p>
              </Link>

              <Link
                href="/admin/queue"
                className="p-5 bg-slate-950/80 hover:bg-slate-800/80 rounded-xl border border-slate-800 hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">⏳</span>
                  <span className="font-bold text-white group-hover:text-sky-400 transition-colors">
                    Queue Monitor & Matcher
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  View waiting users in real-time, force manual pair matching, and kick users from queue.
                </p>
              </Link>

              <Link
                href="/admin/vip"
                className="p-5 bg-slate-950/80 hover:bg-slate-800/80 rounded-xl border border-slate-800 hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">👑</span>
                  <span className="font-bold text-white group-hover:text-amber-400 transition-colors">
                    VIP & Points Ledger
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Audit all points transactions (welcome, daily rewards, referrals, purchases) & manage VIP plans.
                </p>
              </Link>

              <Link
                href="/admin/media"
                className="p-5 bg-slate-950/80 hover:bg-slate-800/80 rounded-xl border border-slate-800 hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">📁</span>
                  <span className="font-bold text-white group-hover:text-rose-400 transition-colors">
                    Media Gallery Inspector
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Browse uploaded photos, audio voice notes, and videos stored on Cloudflare R2 with deletion control.
                </p>
              </Link>

              <Link
                href="/admin/broadcast"
                className="p-5 bg-slate-950/80 hover:bg-slate-800/80 rounded-xl border border-indigo-900/40 hover:border-indigo-600/60 transition-all group bg-gradient-to-r from-purple-950/20 to-transparent"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">📢</span>
                  <span className="font-bold text-purple-300 group-hover:text-white transition-colors">
                    Push Broadcast & Alerts
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Send immediate broadcasts and custom announcements to all or filtered Telegram bot users.
                </p>
              </Link>

              <Link
                href="/admin/reports"
                className="p-5 bg-slate-950/80 hover:bg-slate-800/80 rounded-xl border border-rose-900/40 hover:border-rose-600/60 transition-all group bg-gradient-to-r from-rose-950/20 to-transparent"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🚨</span>
                  <span className="font-bold text-rose-300 group-hover:text-white transition-colors">
                    Abuse Reports & Moderation
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Review flagged user reports, inspect chat sessions, dismiss false reports, or 1-click ban offenders.
                </p>
              </Link>

              <Link
                href="/admin/settings"
                className="p-5 bg-slate-950/80 hover:bg-slate-800/80 rounded-xl border border-slate-800 hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">⚙️</span>
                  <span className="font-bold text-white group-hover:text-amber-400 transition-colors">
                    Dynamic Settings & Audit
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Tune points economy rewards, toggle maintenance mode, set greeting banners, & inspect audit trail.
                </p>
              </Link>

              <Link
                href="/admin/reconnect"
                className="p-5 bg-slate-950/80 hover:bg-slate-800/80 rounded-xl border border-slate-800 hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🔄</span>
                  <span className="font-bold text-white group-hover:text-cyan-400 transition-colors">
                    Reconnect Invitations
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Manage partner reconnection requests, review statuses, and cancel pending reconnect requests.
                </p>
              </Link>

              <Link
                href="/admin/database"
                className="p-5 bg-slate-950/80 hover:bg-slate-800/80 rounded-xl border border-indigo-900/40 hover:border-indigo-600/60 transition-all group bg-gradient-to-r from-blue-950/20 to-transparent"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🗄️</span>
                  <span className="font-bold text-blue-300 group-hover:text-white transition-colors">
                    Database Center & Explorer
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Full 14-table database introspection, JSON record inspector, maintenance tasks, and data export.
                </p>
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
