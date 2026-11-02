import Link from "next/link";
import { MessageCircle, Search, Send } from "lucide-react";
import { TELEGRAM_URL, WHATSAPP_URL } from "@/lib/channels";

/**
 * Replaces the prototype's newsletter box, which promised weekly emails nothing
 * sends and claimed "8,200+ Ghanaians" had signed up. The chat bots are real
 * and already answer the same checks, so this points at those instead — and at
 * the paste box when neither channel is configured.
 */
export function ChannelsCTA() {
  return (
    <section className="bg-primary rounded-2xl p-8 md:p-10 mt-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Check from where you already chat</h2>
          <p className="text-sm text-gray-300 max-w-md">
            Forward a message, send a screenshot, or type a name. The same records, the
            same wording — we don&apos;t store your number or your messages.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 flex-shrink-0">
          {WHATSAPP_URL && (
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-5 py-3 text-sm font-bold text-white hover:brightness-110 transition-all min-h-[44px]"
            >
              <MessageCircle className="w-4 h-4" aria-hidden />
              WhatsApp
            </a>
          )}
          {TELEGRAM_URL && (
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#2AABEE] px-5 py-3 text-sm font-bold text-white hover:brightness-110 transition-all min-h-[44px]"
            >
              <Send className="w-4 h-4" aria-hidden />
              Telegram
            </a>
          )}
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-bold text-primary hover:brightness-110 transition-all min-h-[44px]"
          >
            <Search className="w-4 h-4" aria-hidden />
            Check here
          </Link>
        </div>
      </div>
    </section>
  );
}
