"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export default function AdminFilterSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [isOpen, setIsOpen] = useState(true);

  // Read current filters from URL
  const currentGender = searchParams.get("gender") || "ALL";
  const currentVip = searchParams.get("vip") || "";
  const currentVerified = searchParams.get("verified") || "";
  const currentCountry = searchParams.get("country") || "ALL";
  const currentBanned = searchParams.get("banned") || "";

  // Check how many filters are active
  const activeFilterCount =
    (currentGender !== "ALL" ? 1 : 0) +
    (currentVip ? 1 : 0) +
    (currentVerified ? 1 : 0) +
    (currentCountry !== "ALL" ? 1 : 0) +
    (currentBanned ? 1 : 0);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "ALL") {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleResetFilters() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("gender");
    params.delete("vip");
    params.delete("verified");
    params.delete("country");
    params.delete("banned");

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const genderOptions = [
    { label: "All Genders", value: "ALL", icon: "👥" },
    { label: "Male", value: "Male", icon: "👨" },
    { label: "Female", value: "Female", icon: "👩" },
    { label: "Trans Man", value: "Trans Man", icon: "🏳️‍⚧️" },
    { label: "Trans Woman", value: "Trans Woman", icon: "🏳️‍⚧️" },
    { label: "Non-binary", value: "Non-binary", icon: "🧑" },
  ];

  const countryOptions = [
    { label: "All Countries", value: "ALL" },
    { label: "Sri Lanka", value: "Sri Lanka" },
    { label: "India", value: "India" },
    { label: "United States", value: "United States" },
    { label: "United Kingdom", value: "United Kingdom" },
    { label: "UAE", value: "UAE" },
    { label: "Canada", value: "Canada" },
    { label: "Australia", value: "Australia" },
  ];

  return (
    <>
      {/* Toggle button when collapsed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed left-64 top-20 z-30 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-r-xl shadow-lg border-y border-r border-indigo-400/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
          title="Open Gender & Status Filter Panel"
        >
          <span>🎯</span>
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-white text-indigo-700 font-bold text-[10px] flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      )}

      {/* Filter Sidebar (Placed beside the main navigation sidebar) */}
      <aside
        className={`${
          isOpen ? "w-72" : "w-0 hidden"
        } bg-slate-900/95 border-r border-slate-800 flex flex-col justify-between shrink-0 transition-all duration-200 z-20 shadow-xl overflow-y-auto`}
      >
        <div className="p-5 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <div>
                <h2 className="text-sm font-bold text-white leading-tight">
                  Gender & VIP Filter
                </h2>
                <p className="text-[11px] text-slate-400">
                  Targeted segmentation
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {activeFilterCount > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 rounded hover:bg-rose-950/40 transition-colors"
                  title="Clear all filters"
                >
                  Reset
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
                title="Collapse filter panel"
              >
                ◀
              </button>
            </div>
          </div>

          {/* Gender Filter (Core Feature) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <span>🚻</span>
                <span>Gender Filter</span>
              </label>
              {currentGender !== "ALL" && (
                <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded font-bold">
                  Active
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {genderOptions.map((opt) => {
                const isSelected = currentGender === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => updateFilter("gender", opt.value)}
                    className={`px-2.5 py-2 rounded-lg text-xs font-medium text-left flex items-center gap-2 border transition-all ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30"
                        : "bg-slate-950/60 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60"
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* VIP Package Status Filter */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <span>👑</span>
                <span>VIP Package Status</span>
              </label>
            </div>

            <div className="flex flex-col gap-1.5">
              {[
                { label: "All Plans", value: "" },
                { label: "👑 Active VIP Only", value: "true" },
                { label: "🆓 Free Plan Only", value: "false" },
              ].map((opt) => {
                const isSelected = currentVip === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => updateFilter("vip", opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium text-left border transition-all ${
                      isSelected
                        ? "bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-600/30"
                        : "bg-slate-950/60 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mandatory Verification & Profile Completion */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <span>🛡️</span>
                <span>Profile Verification</span>
              </label>
            </div>

            <div className="flex flex-col gap-1.5">
              {[
                { label: "All Users", value: "" },
                { label: "✅ Verified & Complete", value: "true" },
                { label: "⚠️ Incomplete Profile", value: "false" },
              ].map((opt) => {
                const isSelected = currentVerified === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => updateFilter("verified", opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium text-left border transition-all ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30"
                        : "bg-slate-950/60 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Country Selection */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <span>🌍</span>
              <span>Country / Location</span>
            </label>

            <select
              value={currentCountry}
              onChange={(e) => updateFilter("country", e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {countryOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Moderation / Ban Filter */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <span>🚨</span>
              <span>Moderation Status</span>
            </label>

            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: "Active", value: "false" },
                { label: "Banned", value: "true" },
              ].map((opt) => {
                const isSelected = currentBanned === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() =>
                      updateFilter("banned", isSelected ? "" : opt.value)
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium text-center border transition-all ${
                      isSelected
                        ? opt.value === "true"
                          ? "bg-rose-600 text-white border-rose-400"
                          : "bg-slate-700 text-white border-slate-500"
                        : "bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer info & live status indicator */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isPending ? "bg-amber-400 animate-spin" : "bg-emerald-400"
              }`}
            ></span>
            <span>
              {isPending ? "Updating queries..." : "Real-time Filter Active"}
            </span>
          </div>

          {activeFilterCount > 0 && (
            <span className="text-indigo-400 font-bold">
              {activeFilterCount} active
            </span>
          )}
        </div>
      </aside>
    </>
  );
}
