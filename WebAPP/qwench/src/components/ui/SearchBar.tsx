"use client";

import { Search } from "lucide-react";

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  showButton?: boolean;
  buttonText?: string;
}

export function SearchBar({
  placeholder = "Search any company, token, or paste a link...",
  showButton = true,
  buttonText = "VERIFY NOW",
}: SearchBarProps) {
  return (
    <div className="flex items-center w-full max-w-2xl rounded-full border border-border bg-surface shadow-lg overflow-hidden">
      <div className="flex items-center flex-1 px-4 gap-3">
        <Search className="w-5 h-5 text-text-muted flex-shrink-0" />
        <input
          type="text"
          placeholder={placeholder}
          className="w-full py-3.5 bg-transparent text-text-primary placeholder:text-text-muted outline-none text-sm"
          aria-label="Search investments"
        />
      </div>
      {showButton && (
        <button className="bg-accent text-primary font-bold text-sm px-6 py-3.5 hover:brightness-110 transition-all cursor-pointer min-h-[44px]">
          {buttonText}
        </button>
      )}
    </div>
  );
}
