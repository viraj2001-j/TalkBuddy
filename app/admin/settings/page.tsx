"use client";

import React, { useState, useEffect } from "react";

interface SettingItem {
  id: string;
  key: string;
  value: string;
  category: string;
  description: string | null;
  updatedAt: string;
}

interface AuditLogItem {
  id: string;
  action: string;
  actorId: string | null;
  targetId: string | null;
  details: string | null;
  createdAt: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingMenu, setSyncingMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<"ECONOMY" | "PLATFORM" | "AUDIT">("ECONOMY");
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form values
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  function showToast(text: string, type: "success" | "error" = "success") {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  }

  async function handleSyncBotMenu() {
    try {
      setSyncingMenu(true);
      const res = await fetch("/api/admin/bot-menu", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast(`Successfully registered ${data.count} commands with Telegram!`);
      } else {
        showToast(data.error || "Failed to sync bot menu", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Network error while syncing bot menu", "error");
    } finally {
      setSyncingMenu(false);
    }
  }

  async function fetchSettings() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings || []);
        setAuditLogs(data.auditLogs || []);

        const initialValues: Record<string, string> = {};
        for (const s of data.settings || []) {
          initialValues[s.key] = s.value;
        }
        setValues(initialValues);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = Object.entries(values).map(([key, value]) => ({
        key,
        value,
      }));

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });

      const data = await res.json();
      if (data.success) {
        showToast("System settings saved successfully!");
        fetchSettings();
      } else {
        showToast(data.error || "Failed to save settings.", "error");
      }
    } catch {
      showToast("Network error while saving settings.", "error");
    } finally {
      setSaving(false);
    }
  }

  const economySettings = settings.filter((s) => s.category === "ECONOMY");
  const platformSettings = settings.filter((s) => s.category === "MAINTENANCE" || s.category === "GENERAL");

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
            <span>⚙️</span> Dynamic System Settings & Audit
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Configure global Telegram points economy, platform maintenance mode, and audit administrative actions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncBotMenu}
            disabled={syncingMenu}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition flex items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            title="Push all 19 bot commands to Telegram servers so they appear in users' Telegram menu popup"
          >
            <span>🤖</span> {syncingMenu ? "Syncing..." : "Sync Telegram Bot Menu"}
          </button>
          <button
            onClick={fetchSettings}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition flex items-center gap-2"
          >
            <span>↻</span> Reload Settings
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("ECONOMY")}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "ECONOMY"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white"
          }`}
        >
          <span>🪙</span> Points Economy ({economySettings.length})
        </button>
        <button
          onClick={() => setActiveTab("PLATFORM")}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "PLATFORM"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white"
          }`}
        >
          <span>🛡️</span> Platform & Maintenance ({platformSettings.length})
        </button>
        <button
          onClick={() => setActiveTab("AUDIT")}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === "AUDIT"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
              : "bg-slate-900 text-slate-400 hover:text-white"
          }`}
        >
          <span>📜</span> Audit Trail ({auditLogs.length})
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading system settings...</div>
      ) : activeTab === "ECONOMY" ? (
        /* Economy Settings Form */
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {economySettings.map((s) => (
              <div
                key={s.key}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-mono">
                      {s.key}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">{s.description}</p>
                  </div>
                  <span className="text-xs text-slate-500 font-semibold px-2 py-0.5 rounded bg-slate-800">
                    Points
                  </span>
                </div>
                <div className="pt-2">
                  <input
                    type="number"
                    min="0"
                    required
                    value={values[s.key] ?? s.value}
                    onChange={(e) => setValues({ ...values, [s.key]: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-white font-mono font-bold text-lg focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition disabled:opacity-50 flex items-center gap-2"
            >
              <span>💾</span> {saving ? "Saving Changes..." : "Save Economy Settings"}
            </button>
          </div>
        </form>
      ) : activeTab === "PLATFORM" ? (
        /* Platform & Maintenance Form */
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-5">
            {/* Maintenance Mode Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🛠️</span> System Maintenance Mode
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xl">
                  When enabled, Telegram matching queue is temporarily halted and users trying to match
                  are informed that scheduled maintenance is underway.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setValues({
                    ...values,
                    MAINTENANCE_MODE: values.MAINTENANCE_MODE === "true" ? "false" : "true",
                  })
                }
                className={`px-5 py-2.5 rounded-xl font-bold text-xs transition shadow-lg ${
                  values.MAINTENANCE_MODE === "true"
                    ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }`}
              >
                {values.MAINTENANCE_MODE === "true" ? "🔴 Maintenance Active" : "🟢 Maintenance Off"}
              </button>
            </div>

            {/* Announcement Banner */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-2">
              <label className="block text-xs font-bold text-indigo-400 uppercase tracking-wider">
                Public Announcement Banner (GLOBAL_ANNOUNCEMENT)
              </label>
              <p className="text-xs text-slate-400">
                Displayed prominently on the public web landing page header banner.
              </p>
              <input
                type="text"
                value={values.GLOBAL_ANNOUNCEMENT ?? ""}
                onChange={(e) => setValues({ ...values, GLOBAL_ANNOUNCEMENT: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Bot Welcome Greeting */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-2">
              <label className="block text-xs font-bold text-indigo-400 uppercase tracking-wider">
                Bot Welcome Message Greeting (BOT_WELCOME_MESSAGE)
              </label>
              <p className="text-xs text-slate-400">
                Primary greeting sent by the bot upon /start setup.
              </p>
              <textarea
                rows={3}
                value={values.BOT_WELCOME_MESSAGE ?? ""}
                onChange={(e) => setValues({ ...values, BOT_WELCOME_MESSAGE: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition disabled:opacity-50 flex items-center gap-2"
            >
              <span>💾</span> {saving ? "Saving Changes..." : "Save Platform Settings"}
            </button>
          </div>
        </form>
      ) : (
        /* Admin Audit Trail Table */
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-lg font-bold text-white">Administrative Audit Trail</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Chronological log of administrative actions, balance adjustments, bans, and setting changes.
            </p>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No audit logs recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/50 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-6">Action</th>
                    <th className="py-3.5 px-6">Actor</th>
                    <th className="py-3.5 px-6">Target / Context</th>
                    <th className="py-3.5 px-6">Details</th>
                    <th className="py-3.5 px-6 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-4 px-6">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            log.action.includes("BAN")
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : log.action.includes("ADJUST") || log.action.includes("CREDIT")
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : log.action.includes("BROADCAST")
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-400 font-mono">
                        {log.actorId || "ADMIN"}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-300 font-mono">
                        {log.targetId ? log.targetId.substring(0, 12) + "..." : "—"}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-400 max-w-sm line-clamp-1">
                        {log.details || "—"}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-400 text-right">
                        {new Date(log.createdAt).toLocaleDateString()}{" "}
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
