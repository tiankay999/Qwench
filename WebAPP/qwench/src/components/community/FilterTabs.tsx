"use client";

import { Chip } from "@/components/ui/Chip";

const tabs = ["All", "Crypto", "Forex", "Ponzi/MLM", "Real Estate"];

interface FilterTabsProps {
  active: string;
  onChange: (tab: string) => void;
}

export function FilterTabs({ active, onChange }: FilterTabsProps) {
  return (
    <div className="flex gap-2 flex-wrap mb-6">
      {tabs.map((tab) => (
        <Chip
          key={tab}
          label={tab}
          active={active === tab}
          onClick={() => onChange(tab)}
        />
      ))}
    </div>
  );
}
