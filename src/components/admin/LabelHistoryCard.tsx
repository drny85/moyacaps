"use client";

/** Every shipping label bought for an Order, latest first (CONTEXT.md "Reship"). */
import React from "react";
import type { Doc } from "@convex/_generated/dataModel";
import { labelHistory } from "@convex/orders/labels";
import { getCarrierTrackingUrl } from "@/lib/tracking";
import { ExternalLink, FileText, Tag } from "lucide-react";

export function LabelHistoryCard({ order }: { order: Doc<"orders"> }) {
  const labels = [...labelHistory(order)].reverse();
  if (labels.length === 0) return null;

  return (
    <div className="p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0c0c14] space-y-3">
      <h3 className="font-display font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
        <Tag className="w-4 h-4 text-amber-500" /> Label history
      </h3>
      <ul className="divide-y divide-zinc-200 dark:divide-white/10">
        {labels.map((label, index) => {
          const trackingUrl = getCarrierTrackingUrl(label.carrier, label.trackingNumber);
          return (
            <li key={`${label.trackingNumber}-${label.purchasedAt}`} className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-semibold">
                  {label.carrier}
                  {label.serviceLevel ? ` · ${label.serviceLevel}` : ""}
                  {index === 0 && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20">
                      Current
                    </span>
                  )}
                  {label.reship && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      Reship
                    </span>
                  )}
                </div>
                <div className="font-mono text-zinc-500">
                  {label.trackingNumber} · {new Date(label.purchasedAt).toLocaleDateString()}
                  {label.cost !== undefined && ` · $${label.cost.toFixed(2)}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a href={label.labelUrl} target="_blank" rel="noopener noreferrer" className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> PDF
                </a>
                {trackingUrl && (
                  <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-500 flex items-center gap-1">
                    <ExternalLink className="w-3.5 h-3.5" /> Track
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default LabelHistoryCard;
