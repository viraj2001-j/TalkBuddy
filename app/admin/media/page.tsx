"use client";

import { useEffect, useState } from "react";

interface MediaItem {
  id: string;
  type: string;
  telegramFileId: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  caption: string | null;
  storagePath: string | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    username: string | null;
    telegramUserId: string;
  };
}

export default function MediaInspectorPage() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    fetchMedia();
  }, [typeFilter]);

  async function fetchMedia() {
    try {
      setLoading(true);
      const url = new URL("/api/admin/media", window.location.origin);
      if (typeFilter) url.searchParams.set("type", typeFilter);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setMediaItems(data.media || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteMedia(mediaId: string) {
    if (!confirm("Are you sure you want to delete this media record?")) return;
    try {
      const res = await fetch(`/api/admin/media?mediaId=${mediaId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        fetchMedia();
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
            Media Gallery Inspector & Storage
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Uploaded photos, voice notes, stickers, and documents stored on Cloudflare R2 and Telegram servers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
          >
            <option value="">All Media Types</option>
            <option value="PHOTO">Photos</option>
            <option value="VIDEO">Videos</option>
            <option value="VOICE">Voice Notes</option>
            <option value="STICKER">Stickers</option>
            <option value="DOCUMENT">Documents</option>
          </select>
          <button
            onClick={fetchMedia}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-medium rounded-xl transition-colors border border-slate-700"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Uploaded By</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Dimensions / Duration</th>
                <th className="px-6 py-4">File Size</th>
                <th className="px-6 py-4">Caption / Note</th>
                <th className="px-6 py-4">Storage Path / File ID</th>
                <th className="px-6 py-4">Upload Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500 animate-pulse">
                    Loading media files...
                  </td>
                </tr>
              ) : mediaItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    No media items found matching filter.
                  </td>
                </tr>
              ) : (
                mediaItems.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{m.user.firstName}</div>
                      {m.user.username && (
                        <div className="text-xs text-indigo-400">@{m.user.username}</div>
                      )}
                      <div className="text-[10px] text-slate-500 font-mono">
                        {m.user.telegramUserId}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-800 text-slate-200">
                        {m.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {m.width && m.height ? `${m.width}x${m.height}` : ""}
                      {m.duration ? ` (${m.duration}s)` : ""}
                      {!m.width && !m.duration ? "—" : ""}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-400">
                      {m.fileSize
                        ? `${(Number(m.fileSize) / 1024).toFixed(1)} KB`
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-300 max-w-xs truncate">
                      {m.caption || "—"}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500 max-w-xs truncate">
                      {m.storagePath || m.telegramFileId}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteMedia(m.id)}
                        className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900 text-rose-300 text-xs font-semibold rounded-lg border border-rose-800/40 transition-colors"
                      >
                        🗑️ Delete
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
