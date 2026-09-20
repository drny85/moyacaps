"use client";

import React, { useEffect } from "react";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  isProcessing?: boolean;
  labelledBy: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export function AdminModal({
  isOpen,
  onClose,
  isProcessing = false,
  labelledBy,
  maxWidthClass = "max-w-lg",
  children,
}: AdminModalProps) {
  useLockBodyScroll(isOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto overscroll-contain"
      style={{ overscrollBehavior: "contain" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        data-lenis-prevent
        className={`${maxWidthClass} w-full bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl space-y-5 text-left max-h-[90vh] overflow-y-auto overscroll-contain`}
        style={{ overscrollBehavior: "contain" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export default AdminModal;
