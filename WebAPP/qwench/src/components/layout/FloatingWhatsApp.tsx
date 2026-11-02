"use client";

import { MessageCircle } from "lucide-react";

export function FloatingWhatsApp() {
  return (
    <a
      href="https://wa.me/233XXXXXXXXX"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#25D366] text-white rounded-full shadow-lg hover:shadow-xl transition-all group min-h-[44px]"
      aria-label="Quick check on WhatsApp"
    >
      <div className="flex items-center justify-center w-14 h-14 rounded-full">
        <MessageCircle className="w-6 h-6" fill="white" />
      </div>
      <span className="hidden group-hover:inline-block pr-4 text-sm font-medium whitespace-nowrap">
        Quick check on WhatsApp
      </span>
    </a>
  );
}
