"use client";

import { useStore } from "@/store/useStore";
import { VirtualTryOnStudio } from "./VirtualTryOnStudio";
import { motion, AnimatePresence } from "framer-motion";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";

export function VirtualTryOnModal() {
  const { isTryOnOpen, closeTryOn, tryOnTargetCap } = useStore();
  useLockBodyScroll(isTryOnOpen);

  if (!isTryOnOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className="w-full max-w-5xl my-auto"
      >
        <VirtualTryOnStudio
          initialCap={tryOnTargetCap}
          onClose={closeTryOn}
          isModal={true}
        />
      </motion.div>
    </div>
  );
}
