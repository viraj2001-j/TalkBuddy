import Link from "next/link";
import React, { Suspense } from "react";
import AdminFilterSidebar from "./components/AdminFilterSidebar";

export const metadata = {
  title: "TalkBuddy Admin Portal",
  description: "Web Admin Dashboard for TalkBuddy Telegram Bot",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 antialiased font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Header / Brand */}
          <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            <img
              src="/talkbuddy-dp.jpg"
              alt="TalkBuddy Logo"
              className="w-9 h-9 rounded-xl object-cover shadow-lg shadow-indigo-500/30 border border-indigo-500/20"
            />
            <div>
              <h1 className="font-bold text-slate-100 leading-none">TalkBuddy</h1>
              <span className="text-xs text-indigo-400 font-medium tracking-wide">
                Admin Portal
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5 text-sm font-medium">
            <Link
              href="/admin"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span className="text-lg">📊</span> Overview & Stats
            </Link>
            <Link
              href="/admin/users"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span className="text-lg">👥</span> User Management
            </Link>
            <Link
              href="/admin/payments"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span className="text-lg">💰</span> Points & Payments
            </Link>
            <Link
              href="/admin/chats"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span className="text-lg">💬</span> Live Chat Monitor
            </Link>
            <Link
              href="/admin/queue"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span className="text-lg">⏳</span> Queue Monitor
            </Link>
            <Link
              href="/admin/vip"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span className="text-lg">👑</span> VIP & Points Ledger
            </Link>
            <Link
              href="/admin/media"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span className="text-lg">📁</span> Media Inspector
            </Link>
            <Link
              href="/admin/broadcast"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span className="text-lg">📢</span> Push Broadcast
            </Link>
            <Link
              href="/admin/reports"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span className="text-lg">🚨</span> Reports & Moderation
            </Link>
            <Link
              href="/admin/reconnect"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span className="text-lg">🔄</span> Reconnect Requests
            </Link>
            <Link
              href="/admin/settings"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span className="text-lg">⚙️</span> System Settings
            </Link>
            <Link
              href="/admin/database"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span className="text-lg">🗄️</span> Database Center
            </Link>
          </nav>
        </div>

        {/* Status Footer */}
        <div className="p-4 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-semibold text-slate-200">System Online</span>
          </div>
          <p>Connected to PostgreSQL & Bot Service</p>
          <div className="mt-3">
            <Link
              href="/"
              className="text-indigo-400 hover:text-indigo-300 text-xs font-medium flex items-center gap-1"
            >
              🌐 View Public Landing Page →
            </Link>
          </div>
        </div>
      </aside>

      {/* Gender & Status Filter Sidebar (Beside Left Navigation Sidebar) */}
      <Suspense fallback={null}>
        <AdminFilterSidebar />
      </Suspense>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-950 p-8">
        {children}
      </main>
    </div>
  );
}
