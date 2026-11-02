"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

/** Shares the page's own address. Nothing about the check is put in the link. */
export function ShareButton({ title }: { title?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Dismissed, or unavailable on this device: fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      onClick={share}
      className="flex items-center justify-center gap-2 w-full rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-alt transition-colors cursor-pointer min-h-[44px]"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-safe" aria-hidden />
          Link copied
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4" aria-hidden />
          Share
        </>
      )}
    </button>
  );
}
