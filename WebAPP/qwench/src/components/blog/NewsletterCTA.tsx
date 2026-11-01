"use client";

export function NewsletterCTA() {
  return (
    <section className="bg-primary rounded-2xl p-8 md:p-12 mt-12">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">
            Weekly scam alerts in your inbox
          </h3>
          <p className="text-sm text-gray-300">
            Join 8,200+ Ghanaians getting the week&apos;s biggest warnings every
            Friday.
          </p>
        </div>
        <div className="flex w-full md:w-auto">
          <input
            type="email"
            placeholder="you@example.com"
            className="flex-1 md:w-64 rounded-l-lg bg-white/10 border border-white/20 px-4 py-3 text-sm text-white placeholder:text-gray-400 outline-none focus:border-accent transition-colors"
            aria-label="Email for newsletter"
          />
          <button className="bg-accent text-primary font-bold text-sm px-6 py-3 rounded-r-lg hover:brightness-110 transition-all cursor-pointer min-h-[44px]">
            Subscribe
          </button>
        </div>
      </div>
    </section>
  );
}
