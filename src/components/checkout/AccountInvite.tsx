"use client";

import { Link } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Check, UserPlus } from "lucide-react";
import { SafeSignInButton, useSafeUser } from "@/lib/useSafeUser";
import { accountOrdersPath, confirmationAccountOffer } from "@/lib/accountInvite";

/**
 * The confirmation page's account offer: "View orders" for a signed-in Customer, the
 * Account Invite for a guest. Sign-up and sign-in open with the checkout email, the only
 * one that claims this guest Order (ADR 0026).
 */
export function AccountInvite({ email }: { email?: string }) {
  const t = useTranslations("checkoutSuccess");
  const locale = useLocale();
  const offer = confirmationAccountOffer(useSafeUser());

  if (offer === "none") return null;

  if (offer === "viewOrders") {
    return (
      <Link
        href="/account/orders"
        className="w-full py-3 rounded-2xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-zinc-900 dark:text-white font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-black/[0.06] dark:border-white/[0.06]"
      >
        <span>{t("viewOrders")}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    );
  }

  const redirect = { forceRedirectUrl: accountOrdersPath(locale), emailAddress: email };
  const benefits = [t("accountInvite.benefitOrders"), t("accountInvite.benefitCancel"), t("accountInvite.benefitReviews")];

  return (
    <div className="p-5 rounded-3xl glass-card border border-black/[0.06] dark:border-white/[0.06]">
      <h3 className="font-display font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-moya-red" />
        <span>{t("accountInvite.title")}</span>
      </h3>
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
        {email
          ? t.rich("accountInvite.body", {
              email,
              strong: (chunks) => <strong className="text-zinc-900 dark:text-white break-all">{chunks}</strong>,
            })
          : t("accountInvite.bodyNoEmail")}
      </p>
      <ul className="mt-3 space-y-1.5">
        {benefits.map((benefit) => (
          <li key={benefit} className="flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200">
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>
      <SafeSignInButton flow="signUp" {...redirect}>
        <button
          type="button"
          className="mt-4 w-full py-3 rounded-2xl bg-moya-red hover:bg-moya-red-light text-white font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-moya-red/25 active:scale-[0.98]"
        >
          <span>{t("accountInvite.createAccount")}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </SafeSignInButton>
      <SafeSignInButton {...redirect}>
        <button
          type="button"
          className="mt-2 w-full text-center text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors font-display"
        >
          {t("accountInvite.signIn")}
        </button>
      </SafeSignInButton>
    </div>
  );
}
