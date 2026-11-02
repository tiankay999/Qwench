"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * The check field. Anything goes in: a name, a MoMo number, a wallet, a link,
 * or a whole forwarded message. Working out which is which is the API's job,
 * so nothing here tries to classify what was typed.
 *
 * It is the one control most people will ever use, which is why it is 60px
 * tall and why the input is 18px. Under 16px, iOS Safari zooms the viewport
 * on focus — on a mid-range Android or an iPhone held mid-payment, that turns
 * the primary action of the whole site into a fight with the browser.
 */
export function SearchBar({
  placeholder = "Name, number, link or wallet address",
  buttonText = "Check",
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
        "flex w-full max-w-2xl items-center gap-3 rounded-[14px] border border-border-strong bg-surface py-2 pl-5 pr-2",
        "min-h-[60px] transition-[border-color,box-shadow] duration-150 ease-out-expo",
        "focus-within:border-accent-bright focus-within:shadow-raised",
        className,
      )}
    >
      <Search
        className="size-5 shrink-0 text-text-muted"
        strokeWidth={1.75}
        aria-hidden
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        /* The ring lives on the form, so the input suppresses its own. */
        className="w-full min-w-0 bg-transparent text-lg text-text-primary outline-none placeholder:text-text-muted focus-visible:outline-none"
        aria-label="What do you want to check?"
      />
      <button
        type="submit"
        className={cn(
          "shrink-0 cursor-pointer rounded-[10px] bg-accent px-6 py-3 text-base font-semibold text-white",
          "min-h-[44px] transition-colors duration-150 ease-out-expo hover:bg-accent-bright",
        )}
      >
        {buttonText}
      </button>
    </form>
  );
}
