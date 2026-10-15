"use client";

import { useEffect, useState } from "react";

interface UserInfo {
  id: string;
  firstName: string;
  lastName?: string | null;
  username: string | null;
  telegramUserId: string;
}

interface ChatSession {
  id: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  endReason: string | null;
  userOne: UserInfo;
  userTwo: UserInfo;
  _count?: { messages: number };
}

interface ChatMessage {
  id: string;
  senderId: string;
  messageType: string;
  text: string | null;
  mediaPath: string | null;
  createdAt: string;
  sender: {
    id: string;
    firstName: string;
    username: string | null;
  };
}

export default function LiveChatMonitorPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [terminating, setTerminating] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, [statusFilter]);

  async function fetchSessions() {
    try {
      setLoading(true);
      const url = new URL("/api/admin/chats", window.location.origin);
      if (statusFilter) url.searchParams.set("status", statusFilter);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenTranscript(session: ChatSession) {
    setSelectedSession(session);
    try {
      setLoadingTranscript(true);
      const res = await fetch(`/api/admin/chats?sessionId=${session.id}`);
      const data = await res.json();
      if (data.success && data.session) {
        setTranscript(data.session.messages || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTranscript(false);
    }
  }

  async function handleTerminateSession(sessionId: string) {
    if (!confirm("Are you sure you want to force terminate this active chat session?")) {
      return;
    }
    try {
      setTerminating(true);
      const res = await fetch("/api/admin/chats", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          endReason: "TERMINATED_BY_ADMIN",
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchSessions();
        if (selectedSession?.id === sessionId) {
          setSelectedSession((prev) =>
            prev ? { ...prev, status: "ENDED", endReason: "TERMINATED_BY_ADMIN" } : null
          );
        }
      } else {
        alert("Error terminating session: " + data.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setTerminating(false);
    }
  }

  async function handleDeleteSession(sessionId: string) {
    if (!confirm("Delete this session record and its transcript permanently?")) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/chats?sessionId=${sessionId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        if (selectedSession?.id === sessionId) {
          setSelectedSession(null);
          setTranscript([]);
        }
        fetchSessions();
      } else {
        alert("Error deleting session: " + data.error);
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
            Live Chat Monitor & Transcripts
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time chat session activity, transcripts inspection, and session termination controls.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
          >
            <option value="">All Chat Sessions</option>
            <option value="ACTIVE">● Active Now</option>
            <option value="ENDED">Ended</option>
          </select>
          <button
            onClick={fetchSessions}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-medium rounded-xl transition-colors border border-slate-700"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions List Column */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 h-[720px] flex flex-col">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Sessions Pool ({sessions.length})
            </h2>
            <span className="text-[11px] text-slate-500">Click to view log</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {loading ? (
              <div className="text-center py-12 text-slate-500 text-sm animate-pulse">
                Loading sessions...
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No chat sessions found.
              </div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => handleOpenTranscript(s)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedSession?.id === s.id
                      ? "bg-indigo-950/60 border-indigo-500/80 shadow-md"
                      : "bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === "ACTIVE"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {s.status}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(s.startedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-slate-200 truncate">
                    {s.userOne.firstName} ↔ {s.userTwo.firstName}
                  </div>

                  <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>💬 {s._count?.messages ?? 0} messages</span>
                    {s.endReason && (
                      <span className="text-[10px] text-slate-500 truncate max-w-[100px]">
                        {s.endReason}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Transcript Reader Column */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 h-[720px] flex flex-col">
          {selectedSession ? (
            <>
              {/* Header */}
              <div className="border-b border-slate-800 pb-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>
                      {selectedSession.userOne.firstName} ↔ {selectedSession.userTwo.firstName}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        selectedSession.status === "ACTIVE"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {selectedSession.status}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Started: {new Date(selectedSession.startedAt).toLocaleString()}{" "}
                    {selectedSession.endedAt &&
                      `• Ended: ${new Date(selectedSession.endedAt).toLocaleTimeString()}`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedSession.status === "ACTIVE" && (
                    <button
                      onClick={() => handleTerminateSession(selectedSession.id)}
                      disabled={terminating}
                      className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 text-xs font-semibold rounded-lg border border-rose-800 transition-colors"
                    >
                      🛑 Force Terminate
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteSession(selectedSession.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                  >
                    🗑️ Delete Log
                  </button>
                </div>
              </div>

              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-slate-950 rounded-xl border border-slate-800/80">
                {loadingTranscript ? (
                  <div className="text-center py-16 text-slate-500 text-sm animate-pulse">
                    Loading transcript messages...
                  </div>
                ) : transcript.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-sm">
                    💬 No messages logged in this conversation session yet.
                  </div>
                ) : (
                  transcript.map((msg) => {
                    const isUserOne = msg.senderId === selectedSession.userOne.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col max-w-[80%] ${
                          isUserOne ? "mr-auto items-start" : "ml-auto items-end"
                        }`}
                      >
                        <div className="text-[10px] text-slate-400 mb-1 px-1 font-medium flex items-center gap-1.5">
                          <span>{msg.sender.firstName}</span>
                          <span className="text-slate-600 font-mono">
                            {new Date(msg.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div
                          className={`p-3 rounded-2xl text-xs leading-relaxed ${
                            isUserOne
                              ? "bg-indigo-900/60 text-indigo-100 border border-indigo-700/50 rounded-tl-none"
                              : "bg-slate-800 text-slate-100 border border-slate-700/60 rounded-tr-none"
                          }`}
                        >
                          {msg.text || `[${msg.messageType} Media]`}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm space-y-2">
              <span className="text-3xl">👈</span>
              <p>Select a chat session from the left to read live transcript.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
