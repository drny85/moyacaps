"use client";

import { useLocale } from "next-intl";
import { useStore } from "@/store/useStore";
import { useCallback } from "react";

interface ShareCapData {
  id: string;
  name: string;
  image: string;
}

export function useProductShare() {
  const locale = useLocale();
  const showShareToast = useStore((s) => s.showShareToast);

  const shareProduct = useCallback(
    async (cap: ShareCapData) => {
      if (typeof window === "undefined") return;

      const origin =
        window.location.origin ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "https://moyacaps.vercel.app";

      const shareUrl = `${origin}/${locale}/caps/${cap.id}`;

      // 1. Copy URL directly to clipboard
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(shareUrl);
        } else {
          // Fallback for non-secure contexts or legacy browsers
          const textarea = document.createElement("textarea");
          textarea.value = shareUrl;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
        }
      } catch (err) {
        console.warn("Failed to copy link to clipboard automatically:", err);
      }

      // 2. Trigger post-copy guidance notification toast
      showShareToast({
        capName: cap.name,
        url: shareUrl,
        capImage: cap.image,
      });
    },
    [locale, showShareToast]
  );

  return { shareProduct };
}
