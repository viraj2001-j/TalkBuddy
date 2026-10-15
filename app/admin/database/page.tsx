"use client";

import React, { useState, useEffect } from "react";

interface Telemetry {
  status: string;
  database: string;
  provider: string;
  latencyMs: number;
  dbSize: string;
  totalTables: number;
}

export default function AdminDatabasePage() {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [selectedTable, setSelectedTable] = useState<string>("User");
  const [tableRows, setTableRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [jsonModalRow, setJsonModalRow] = useState<any | null>(null);
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchDatabaseOverview();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchTableRows(selectedTable);
    }
  }, [selectedTable]);

  function showToast(text: string, type: "success" | "error" = "success") {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  }

  async function fetchDatabaseOverview() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/database");
      const data = await res.json();
      if (data.success) {
        setTelemetry(data.telemetry);
        setTableCounts(data.tableCounts || {});
      }
    } catch (err) {
      console.error("Failed to fetch database telemetry:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTableRows(table: string) {
    try {
      setLoadingRows(true);
      const res = await fetch(`/api/admin/database?table=${table}&limit=100`);
      const data = await res.json();
      if (data.success && data.tableData) {
        setTableRows(data.tableData.rows || []);
      } else {
        setTableRows([]);
      }
    } catch (err) {
      console.error(`Failed to fetch rows for ${table}:`, err);
    } finally {
      setLoadingRows(false);
    }
  }

  async function executeAction(action: string, extra?: Record<string, any>) {
    try {
      setActionLoading(true);
      const res = await fetch("/api/admin/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || "Operation completed.");
        fetchDatabaseOverview();
        if (selectedTable) fetchTableRows(selectedTable);
      } else {
        showToast(data.error || "Operation failed.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteRow(rowId: string) {
    if (!confirm(`Are you sure you want to delete row "${rowId}" from ${selectedTable}?`)) return;
    await executeAction("DELETE_ROW", { table: selectedTable, rowId });
  }

  function handleExportJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tableRows, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${selectedTable}_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast(`Exported ${tableRows.length} rows to JSON.`);
  }

  // Filter rows based on search
  const filteredRows = tableRows.filter((row) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(row).some((val) =>
      String(val).toLowerCase().includes(term)
    );
  });

  // Extract column keys from rows
  const columns = tableRows.length > 0 ? Object.keys(tableRows[0]) : [];

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
            <span>🗄️</span> Database Center & Explorer
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Complete introspection, live table explorer, JSON inspection, and maintenance for all 14 database models.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchDatabaseOverview();
              fetchTableRows(selectedTable);
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition flex items-center gap-2"
          >
            <span>↻</span> Refresh Telemetry
          </button>
        </div>
      </div>

      {/* Telemetry Cards */}
      {telemetry && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Engine Status</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-xl font-bold text-emerald-400">{telemetry.status}</p>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">PostgreSQL Online</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Database</span>
            <p className="text-xl font-bold text-white mt-1 font-mono">{telemetry.database}</p>
            <span className="text-[11px] text-slate-500 mt-1 block">localhost:5432</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Query Latency</span>
            <p className="text-xl font-bold text-indigo-400 mt-1">{telemetry.latencyMs} ms</p>
            <span className="text-[11px] text-indigo-400/80 mt-1 block">Sub-millisecond ping</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Disk Size</span>
            <p className="text-xl font-bold text-amber-400 mt-1">{telemetry.dbSize}</p>
            <span className="text-[11px] text-slate-500 mt-1 block">Active storage size</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Managed Tables</span>
            <p className="text-xl font-bold text-purple-400 mt-1">{telemetry.totalTables} Tables</p>
            <span className="text-[11px] text-purple-400/80 mt-1 block">All models registered</span>
          </div>
        </div>
      )}

      {/* Database Maintenance Operations Action Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span>🛠️</span> Database Maintenance & Operations
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => executeAction("CLEAN_STALE_QUEUES")}
            disabled={actionLoading}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 hover:border-slate-600 flex items-center gap-2 disabled:opacity-50"
          >
            <span>🧹</span> Clean Stale Matching Queues
          </button>
          <button
            onClick={() => executeAction("PURGE_OLD_ENDED_CHATS")}
            disabled={actionLoading}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 hover:border-slate-600 flex items-center gap-2 disabled:opacity-50"
          >
            <span>🗑️</span> Purge Inactive Sessions (&gt;30d)
          </button>
          <button
            onClick={() => executeAction("OPTIMIZE_DATABASE")}
            disabled={actionLoading}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold transition border border-indigo-900/60 hover:border-indigo-600 flex items-center gap-2 disabled:opacity-50"
          >
            <span>⚡</span> Run PostgreSQL ANALYZE
          </button>
          <button
            onClick={handleExportJson}
            disabled={tableRows.length === 0}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shadow-lg shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-50"
          >
            <span>📥</span> Export {selectedTable} to JSON
          </button>
        </div>
      </div>

      {/* Table Selector Pills */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Database Table</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(tableCounts).map(([tableName, count]) => (
            <button
              key={tableName}
              onClick={() => setSelectedTable(tableName)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                selectedTable === tableName
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
              }`}
            >
              <span>{tableName}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  selectedTable === tableName
                    ? "bg-indigo-950 text-indigo-200"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Table Explorer View */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm space-y-0">
        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>📁</span> {selectedTable} Records
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              {tableRows.length} rows loaded
            </span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input
              type="text"
              placeholder={`Search in ${selectedTable}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-full sm:w-64"
            />
          </div>
        </div>

        {loadingRows ? (
          <div className="p-12 text-center text-slate-400">Loading {selectedTable} rows...</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No rows found in {selectedTable}. Table is currently empty.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800 sticky top-0 backdrop-blur-md">
                <tr>
                  <th className="py-3 px-4 text-center">Inspect</th>
                  {columns.map((col) => (
                    <th key={col} className="py-3 px-4 whitespace-nowrap font-mono">
                      {col}
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {filteredRows.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-2.5 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => setJsonModalRow(row)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white transition font-sans text-[11px]"
                      >
                        👁️ JSON
                      </button>
                    </td>
                    {columns.map((col) => {
                      const val = row[col];
                      const displayVal =
                        val === null || val === undefined
                          ? "null"
                          : typeof val === "boolean"
                          ? val
                            ? "true"
                            : "false"
                          : typeof val === "object"
                          ? JSON.stringify(val)
                          : String(val);

                      return (
                        <td key={col} className="py-2.5 px-4 max-w-xs truncate whitespace-nowrap">
                          {displayVal}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      {row.id && (
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          className="px-2 py-1 rounded text-rose-400 hover:text-white hover:bg-rose-950/60 transition font-sans text-[11px]"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* JSON Inspector Modal */}
      {jsonModalRow && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>🔍</span> Raw Row Inspector — {selectedTable}
              </h3>
              <button
                onClick={() => setJsonModalRow(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-emerald-400 max-h-96 overflow-y-auto overflow-x-auto">
              {JSON.stringify(jsonModalRow, null, 2)}
            </pre>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setJsonModalRow(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
