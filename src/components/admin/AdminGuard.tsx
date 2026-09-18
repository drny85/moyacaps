"use client";

import React, { useState, useEffect } from "react";
import { useSafeUser, SafeSignInButton } from "@/lib/useSafeUser";
import { checkIsAdmin, PRIMARY_ADMIN_EMAIL } from "@/lib/adminAuth";
import { ShieldAlert, Lock, ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded, isSignedIn } = useSafeUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isLoaded) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-10 h-10 border-2 border-moya-red border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs uppercase tracking-widest font-mono text-zinc-500">
          Verifying administrative credentials...
        </p>
      </div>
    );
  }

  // Not signed in
  if (!isSignedIn) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 rounded-2xl p-8 shadow-2xl text-center relative overflow-hidden">
          <div className="w-14 h-14 rounded-2xl bg-moya-red/10 dark:bg-moya-red/20 border border-moya-red/30 flex items-center justify-center mx-auto mb-6 text-moya-red">
            <Lock className="w-7 h-7" />
          </div>
          <span className="text-[10px] font-mono tracking-widest uppercase px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold mb-3 inline-block">
            MoyaCaps Operations HQ
          </span>
          <h1 className="font-display text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            Administrator Access Required
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-8 leading-relaxed">
            This workspace governs live drops, fulfillment dispatches, and inventory velocity. Please authenticate with your authorized staff account (<code className="font-mono text-zinc-800 dark:text-zinc-200">{PRIMARY_ADMIN_EMAIL}</code>).
          </p>

          <div className="space-y-3">
            <SafeSignInButton mode="modal">
              <button className="w-full py-3 px-4 rounded-xl bg-moya-red hover:bg-moya-red-light text-white font-display font-semibold text-sm transition-all shadow-lg shadow-moya-red/25 hover:shadow-moya-red/40 active:scale-98">
                Sign In to Admin Console
              </button>
            </SafeSignInButton>

            <Link
              href="/"
              className="w-full py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-400 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Signed in, check admin authorization strictly
  const isAuthorized = checkIsAdmin(user);

  if (!isAuthorized) {
    const email = user?.primaryEmailAddress?.emailAddress || "Current Account";

    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#0c0c14] border border-amber-500/20 dark:border-amber-500/30 rounded-2xl p-8 shadow-2xl text-center relative">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-6 text-amber-500">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <span className="text-[10px] font-mono tracking-widest uppercase px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold mb-3 inline-block">
            Access Restricted
          </span>

          <h2 className="font-display text-2xl font-bold text-zinc-900 dark:text-white mb-2">
            Restricted Staff Area
          </h2>

          <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
            Signed in as <span className="font-mono text-zinc-900 dark:text-zinc-200 font-semibold">{email}</span>. Only designated staff (<code className="text-zinc-800 dark:text-zinc-200">{PRIMARY_ADMIN_EMAIL}</code>) with <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-moya-red">role: admin</code> can access the operations suite.
          </p>

          <Link
            href="/"
            className="inline-flex items-center gap-2 py-2 px-4 rounded-xl border border-zinc-200 dark:border-white/10 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Storefront
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
