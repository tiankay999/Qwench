"use client";

import { MessageCircle } from "lucide-react";
import { WHATSAPP_URL } from "@/lib/channels";

/** Hidden unless NEXT_PUBLIC_WHATSAPP_NUMBER is set, so it is never a dead link. */
export function FloatingWhatsApp() {
  if (!WHATSAPP_URL) return null;

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#25D366] text-white rounded-full shadow-lg hover:shadow-xl transition-all group min-h-[44px]"
      aria-label="Check on WhatsApp"
    >
      <div className="flex items-center justify-center w-14 h-14 rounded-full">
        <MessageCircle className="w-6 h-6" fill="white" aria-hidden />
      </div>
      <span className="hidden group-hover:inline-block pr-4 text-sm font-medium whitespace-nowrap">
        Check on WhatsApp
      </span>
    </a>
  );
}
