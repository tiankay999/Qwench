"use client";

import { usePathname } from "next/navigation";

/** Hides the public site's navigation on the console, which has its own. */
export function PublicOnly({ children }: { children: React.ReactNode }) {
  return usePathname().startsWith("/console") ? null : <>{children}</>;
}
