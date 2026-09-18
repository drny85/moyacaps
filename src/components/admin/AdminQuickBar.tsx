"use client";

import React, { useState } from "react";
import { useSafeUser } from "@/lib/useSafeUser";
import { checkIsAdmin } from "@/lib/adminAuth";
import { Link, usePathname } from "@/i18n/routing";
import { Shield, ArrowRight, X, ChevronUp } from "lucide-react";

export function AdminQuickBar() {
  const { user, isSignedIn } = useSafeUser();
  const pathname = usePathname();
  const [minimized, setMinimized] = useState(false);

  // Do not render on admin console pages or if not authenticated admin
  if (pathname.startsWith("/admin") || !isSignedIn || !checkIsAdmin(user)) {
    return null;
  }

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-20 sm:bottom-6 left-4 z-50 p-2.5 rounded-full bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-xl hover:scale-110 active:scale-95 transition-all border border-red-400/40 flex items-center gap-1.5 group"
        title="Show Admin Dashboard Bar"
      >
        <Shield className="w-4 h-4" />
        <span className="text-[10px] font-mono font-bold pr-1">Admin</span>
        <ChevronUp className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:right-auto sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="p-3 sm:p-3.5 rounded-2xl bg-zinc-950/95 dark:bg-[#0c0c14]/95 backdrop-blur-md text-white border border-red-500/30 shadow-2xl shadow-red-950/40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-white shrink-0 shadow-md">
            <Shield className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-400">
                Administrator Mode
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-xs font-display font-medium text-zinc-300 truncate">
              {user?.fullName || user?.primaryEmailAddress?.emailAddress || "Admin Staff"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href="/admin/analytics"
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-display font-bold text-xs flex items-center gap-1.5 shadow-md shadow-red-600/30 transition-all hover:scale-105 active:scale-95"
          >
            <span>Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => setMinimized(true)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Minimize Bar"
            aria-label="Minimize"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
