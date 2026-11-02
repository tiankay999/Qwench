"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * The paste box. Anything goes in: a name, a MoMo number, a wallet, a link, or
 * a whole forwarded message. Working out which is which is the API's job, so
 * nothing here tries to classify what was typed.
 */
export function SearchBar({
  placeholder = "Search any company, token, or paste a link...",
  buttonText = "CHECK",
  initialValue = "",
  autoFocus = false,
  className,
}: {
  placeholder?: string;
  buttonText?: string;
  initialValue?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        "flex items-center w-full max-w-2xl rounded-full border border-border bg-surface shadow-lg overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center flex-1 px-4 gap-3 min-w-0">
        <Search className="w-5 h-5 text-text-muted flex-shrink-0" aria-hidden />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full py-3.5 bg-transparent text-text-primary placeholder:text-text-muted outline-none text-sm"
          aria-label="What do you want to check?"
        />
      </div>
      <button
        type="submit"
        className="bg-accent text-primary font-bold text-sm px-6 py-3.5 hover:brightness-110 transition-all cursor-pointer min-h-[44px] flex-shrink-0"
      >
        {buttonText}
      </button>
    </form>
  );
}
