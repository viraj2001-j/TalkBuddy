"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface User {
  id: string;
  telegramUserId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  gender: string;
  age: number | null;
  country: string | null;
  isProfileComplete: boolean;
  isVerified: boolean;
  verifiedAt: string | null;
  genderFilterPreference: string | null;
  role: string;
  pointsBalance: number;
  isVip: boolean;
  vipExpiresAt: string | null;
  activeVipPlan: string | null;
  isBanned: boolean;
  banReason: string | null;
  referralCode: string | null;
  totalSessions: number;
  totalMessagesSent: number;
  referralCount: number;
  createdAt: string;
}

function UserManagementContent() {
  const searchParams = useSearchParams();

  // Read URL query params from the filter sidebar
  const urlGender = searchParams.get("gender") || "";
  const urlVip = searchParams.get("vip") || "";
  const urlVerified = searchParams.get("verified") || "";
  const urlCountry = searchParams.get("country") || "";
  const urlBanned = searchParams.get("banned") || "";

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vipFilter, setVipFilter] = useState(urlVip);
  const [bannedFilter, setBannedFilter] = useState(urlBanned);

  // Edit modal
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pointsInput, setPointsInput] = useState<number>(0);
  const [addPointsDelta, setAddPointsDelta] = useState<number>(0);
  const [pointsReason, setPointsReason] = useState<string>("");
  const [isVipInput, setIsVipInput] = useState<boolean>(false);
  const [vipDaysInput, setVipDaysInput] = useState<number>(30);
  const [vipPlanInput, setVipPlanInput] = useState<string>("1 Month VIP");
  const [roleInput, setRoleInput] = useState<string>("USER");
  const [isBannedInput, setIsBannedInput] = useState<boolean>(false);
  const [banReasonInput, setBanReasonInput] = useState<string>("");
  const [firstNameInput, setFirstNameInput] = useState<string>("");
  const [lastNameInput, setLastNameInput] = useState<string>("");
  const [genderInput, setGenderInput] = useState<string>("");
  const [ageInput, setAgeInput] = useState<number | "">("");
  const [countryInput, setCountryInput] = useState<string>("");
  const [isProfileCompleteInput, setIsProfileCompleteInput] = useState<boolean>(false);
  const [isVerifiedInput, setIsVerifiedInput] = useState<boolean>(false);
  const [genderFilterPreferenceInput, setGenderFilterPreferenceInput] = useState<string>("ANY");
  const [saving, setSaving] = useState(false);

  // Create User modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTelegramId, setNewTelegramId] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newGender, setNewGender] = useState("Male");
  const [newStartingPoints, setNewStartingPoints] = useState(100);
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [search, vipFilter, bannedFilter, urlGender, urlVip, urlVerified, urlCountry, urlBanned]);

  async function fetchUsers() {
    try {
      setLoading(true);
      const url = new URL("/api/admin/users", window.location.origin);
      if (search) url.searchParams.set("query", search);

      const activeVip = vipFilter || urlVip;
      if (activeVip) url.searchParams.set("vip", activeVip);

      const activeBanned = bannedFilter || urlBanned;
      if (activeBanned) url.searchParams.set("banned", activeBanned);

      if (urlGender && urlGender !== "ALL") url.searchParams.set("gender", urlGender);
      if (urlVerified) url.searchParams.set("verified", urlVerified);
      if (urlCountry && urlCountry !== "ALL") url.searchParams.set("country", urlCountry);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenEdit(user: User) {
    setSelectedUser(user);
    setPointsInput(user.pointsBalance);
    setAddPointsDelta(0);
    setPointsReason("");
    setIsVipInput(user.isVip);
    setVipDaysInput(30);
    setVipPlanInput(user.activeVipPlan || "1 Month Pass");
    setRoleInput(user.role);
    setIsBannedInput(user.isBanned);
    setBanReasonInput(user.banReason || "");
    setFirstNameInput(user.firstName);
    setLastNameInput(user.lastName || "");
    setGenderInput(user.gender);
    setAgeInput(user.age ?? "");
    setCountryInput(user.country || "");
    setIsProfileCompleteInput(user.isProfileComplete || false);
    setIsVerifiedInput(user.isVerified || false);
    setGenderFilterPreferenceInput(user.genderFilterPreference || "ANY");
  }

  async function handleSaveUser() {
    if (!selectedUser) return;
    try {
      setSaving(true);
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          firstName: firstNameInput,
          lastName: lastNameInput,
          gender: genderInput,
          age: ageInput !== "" ? Number(ageInput) : null,
          country: countryInput || null,
          isProfileComplete: isProfileCompleteInput,
          isVerified: isVerifiedInput,
          genderFilterPreference: genderFilterPreferenceInput,
          pointsBalance: pointsInput,
          pointsDelta: addPointsDelta !== 0 ? addPointsDelta : undefined,
          pointsReason: pointsReason || undefined,
          isVip: isVipInput,
          vipDays: isVipInput ? vipDaysInput : undefined,
          activeVipPlan: isVipInput ? vipPlanInput : null,
          role: roleInput,
          isBanned: isBannedInput,
          banReason: isBannedInput ? banReasonInput : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedUser(null);
        fetchUsers();
      } else {
        alert("Error saving user: " + data.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUser(userId: string, name: string) {
    if (!confirm(`Are you sure you want to permanently delete user "${name}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/users?userId=${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert("Error deleting user: " + data.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  }

  async function handleCreateUser() {
    if (!newTelegramId || !newFirstName) {
      alert("Telegram ID and First Name are required");
      return;
    }
    try {
      setCreatingUser(true);
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramUserId: newTelegramId,
          firstName: newFirstName,
          lastName: newLastName,
          username: newUsername,
          gender: newGender,
          pointsBalance: newStartingPoints,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateModalOpen(false);
        fetchUsers();
      } else {
        alert("Error creating user: " + data.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setCreatingUser(false);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            User Management & Permissions
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Search, edit, manage VIP status, verify user profiles, and view Gender Filter settings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
          >
            ➕ Onboard User Manually
          </button>
          <button
            onClick={fetchUsers}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-medium rounded-xl transition-colors border border-slate-700"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Active Sidebar Filter Badges */}
      {(urlGender || urlVip || urlVerified || urlCountry || urlBanned) && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-indigo-950/30 border border-indigo-900/40 rounded-xl text-xs text-slate-300">
          <span className="font-semibold text-indigo-400">Sidebar Filters Active:</span>
          {urlGender && urlGender !== "ALL" && (
            <span className="px-2 py-0.5 rounded bg-indigo-600/30 text-indigo-200 border border-indigo-500/30">
              🚻 Gender: {urlGender}
            </span>
          )}
          {urlVip && (
            <span className="px-2 py-0.5 rounded bg-amber-600/30 text-amber-200 border border-amber-500/30">
              👑 VIP: {urlVip === "true" ? "Yes" : "Free"}
            </span>
          )}
          {urlVerified && (
            <span className="px-2 py-0.5 rounded bg-emerald-600/30 text-emerald-200 border border-emerald-500/30">
              🛡️ Verification: {urlVerified === "true" ? "Complete" : "Incomplete"}
            </span>
          )}
          {urlCountry && urlCountry !== "ALL" && (
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
              🌍 Country: {urlCountry}
            </span>
          )}
          {urlBanned && (
            <span className="px-2 py-0.5 rounded bg-rose-600/30 text-rose-200 border border-rose-500/30">
              🚫 Banned: {urlBanned === "true" ? "Yes" : "No"}
            </span>
          )}
        </div>
      )}

      {/* Search & Quick Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="sm:col-span-2">
          <input
            type="text"
            placeholder="Search name, username, Telegram ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <select
            value={vipFilter}
            onChange={(e) => setVipFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
          >
            <option value="">All VIP Statuses</option>
            <option value="true">👑 VIP Only</option>
            <option value="false">Free Users</option>
          </select>
        </div>

        <div>
          <select
            value={bannedFilter}
            onChange={(e) => setBannedFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
          >
            <option value="">All Account Statuses</option>
            <option value="false">Active Only</option>
            <option value="true">🚫 Suspended / Banned</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-4">User</th>
                <th className="px-5 py-4">Telegram ID</th>
                <th className="px-5 py-4">Gender / Age / Country</th>
                <th className="px-5 py-4">Verification</th>
                <th className="px-5 py-4">VIP & Gender Filter</th>
                <th className="px-5 py-4">Points</th>
                <th className="px-5 py-4">Activity</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                    No users found matching query.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white">
                        {u.firstName} {u.lastName || ""}
                      </div>
                      {u.username && (
                        <div className="text-xs text-indigo-400">@{u.username}</div>
                      )}
                      <div className="text-[10px] text-slate-500">
                        Joined {new Date(u.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-400">
                      {u.telegramUserId}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      <div className="font-medium text-slate-200">
                        {u.gender || "Not set"}
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        {u.age ? `${u.age} yrs` : "Age: —"} • {u.country || "Country: —"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {u.isProfileComplete ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1 w-fit">
                          <span>✅</span> Verified
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 w-fit">
                          ⚠️ Incomplete
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {u.isVip ? (
                        <div>
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-800">
                            👑 VIP ({u.activeVipPlan || "Active"})
                          </span>
                          <div className="text-[11px] text-indigo-300 mt-1">
                            🎯 Wants: <b>{u.genderFilterPreference || "ANY"}</b>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Free User</span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-bold text-indigo-300">
                      💰 {u.pointsBalance}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400">
                      <div>💬 {u.totalSessions} chats ({u.totalMessagesSent} msgs)</div>
                      <div>👥 {u.referralCount} referrals</div>
                    </td>
                    <td className="px-5 py-4">
                      {u.isBanned ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800">
                          🚫 Suspended
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-medium transition-colors"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.firstName)}
                          className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900 text-rose-300 border border-rose-800/40 rounded-lg text-xs font-medium transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Edit Profile & Permissions
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedUser.firstName} • ID: {selectedUser.telegramUserId}
                </p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Names & Gender */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstNameInput}
                    onChange={(e) => setFirstNameInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastNameInput}
                    onChange={(e) => setLastNameInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">
                    Gender
                  </label>
                  <select
                    value={genderInput}
                    onChange={(e) => setGenderInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none text-xs"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Trans Man">Trans Man</option>
                    <option value="Trans Woman">Trans Woman</option>
                    <option value="Non-binary">Non-binary</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">
                    User Role
                  </label>
                  <select
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none text-xs"
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>

              {/* Profile Verification & Gender Filter Controls */}
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    Profile Verification & Gender Filter
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={isProfileCompleteInput}
                        onChange={(e) => setIsProfileCompleteInput(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-500"
                      />
                      Profile Complete
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={isVerifiedInput}
                        onChange={(e) => setIsVerifiedInput(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-500"
                      />
                      Verified User
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                      Age
                    </label>
                    <input
                      type="number"
                      value={ageInput}
                      onChange={(e) =>
                        setAgeInput(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      placeholder="e.g. 24"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      value={countryInput}
                      onChange={(e) => setCountryInput(e.target.value)}
                      placeholder="e.g. Sri Lanka"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                    VIP Gender Filter Preference
                  </label>
                  <select
                    value={genderFilterPreferenceInput}
                    onChange={(e) => setGenderFilterPreferenceInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs"
                  >
                    <option value="ANY">Any Gender (Default)</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Trans Man">Trans Man</option>
                    <option value="Trans Woman">Trans Woman</option>
                    <option value="Non-binary">Non-binary</option>
                  </select>
                </div>
              </div>

              {/* Points Adjustment */}
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Points Balance Management
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Current: {selectedUser.pointsBalance} pts
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                      Direct Set Balance
                    </label>
                    <input
                      type="number"
                      value={pointsInput}
                      onChange={(e) => setPointsInput(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                      Add / Deduct (± Delta)
                    </label>
                    <input
                      type="number"
                      value={addPointsDelta}
                      onChange={(e) => setAddPointsDelta(Number(e.target.value))}
                      placeholder="+100 or -50"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none font-mono text-xs"
                    />
                  </div>
                </div>

                {addPointsDelta !== 0 && (
                  <div>
                    <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                      Adjustment Reason / Note
                    </label>
                    <input
                      type="text"
                      value={pointsReason}
                      onChange={(e) => setPointsReason(e.target.value)}
                      placeholder="e.g. Compensation, special event bonus"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white focus:outline-none text-xs"
                    />
                  </div>
                )}
              </div>

              {/* VIP Membership Controls */}
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                    VIP Membership
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isVipCheck"
                      checked={isVipInput}
                      onChange={(e) => setIsVipInput(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500"
                    />
                    <label htmlFor="isVipCheck" className="text-slate-300 text-xs">
                      Active VIP
                    </label>
                  </div>
                </div>

                {isVipInput && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                        Duration in Days
                      </label>
                      <input
                        type="number"
                        value={vipDaysInput}
                        onChange={(e) => setVipDaysInput(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                        VIP Tag / Plan Name
                      </label>
                      <input
                        type="text"
                        value={vipPlanInput}
                        onChange={(e) => setVipPlanInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Moderation & Account Suspension */}
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">
                    Moderation & Bans
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isBannedCheck"
                      checked={isBannedInput}
                      onChange={(e) => setIsBannedInput(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-500"
                    />
                    <label htmlFor="isBannedCheck" className="text-rose-300 text-xs">
                      Account Suspended
                    </label>
                  </div>
                </div>

                {isBannedInput && (
                  <div>
                    <label className="block text-slate-400 text-[11px] font-semibold mb-1">
                      Reason for Ban
                    </label>
                    <input
                      type="text"
                      value={banReasonInput}
                      onChange={(e) => setBanReasonInput(e.target.value)}
                      placeholder="e.g. Terms violation, offensive behavior"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUser}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-indigo-600/30"
              >
                {saving ? "Saving Changes..." : "Save User Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual User Creation Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Onboard New User</h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1">
                  Telegram User ID *
                </label>
                <input
                  type="text"
                  value={newTelegramId}
                  onChange={(e) => setNewTelegramId(e.target.value)}
                  placeholder="e.g. 123456789"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1">
                  Username (optional)
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="without @"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">
                    Gender
                  </label>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Trans Man">Trans Man</option>
                    <option value="Trans Woman">Trans Woman</option>
                    <option value="Non-binary">Non-binary</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1">
                    Starting Points
                  </label>
                  <input
                    type="number"
                    value={newStartingPoints}
                    onChange={(e) => setNewStartingPoints(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                disabled={creatingUser}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
              >
                {creatingUser ? "Creating..." : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UserManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px] text-slate-400">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading user management...</span>
          </div>
        </div>
      }
    >
      <UserManagementContent />
    </Suspense>
  );
}
