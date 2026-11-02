"use client";

import { ClipboardCheck, FileCode, KeyRound, ListChecks, LogOut, Rss, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ROLE_LABEL, SESSION_ENDED, api, type ConsoleUser } from "@/lib/console";
import { cn } from "@/lib/cn";
import { LoginForm } from "./LoginForm";
import { DemoTag, Loading } from "./ui";

const SessionContext = createContext<ConsoleUser | null>(null);

export function useConsoleUser() {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useConsoleUser needs a signed-in console");
  return user;
}

type NavItem = { href: string; label: string; icon: typeof Search; show?: (user: ConsoleUser) => boolean };

const NAV: NavItem[] = [
  { href: "/console", label: "Lookup", icon: Search },
  { href: "/console/payment-check", label: "Payment check", icon: ClipboardCheck },
  { href: "/console/feed", label: "Daily feed", icon: Rss },
  { href: "/console/review", label: "Review queue", icon: ListChecks, show: (u) => u.role === "reviewer" },
  { href: "/console/keys", label: "API keys", icon: KeyRound, show: (u) => u.role === "org_admin" },
  { href: "/console/docs", label: "API docs", icon: FileCode },
];

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<ConsoleUser | null>(null);
  const [checking, setChecking] = useState(true);

  const signOut = useCallback(async () => {
    await api("/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  useEffect(() => {
    api<{ user: ConsoleUser }>("/me")
      .then(({ user: current }) => setUser(current))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));

    const ended = () => setUser(null);
    window.addEventListener(SESSION_ENDED, ended);
    return () => window.removeEventListener(SESSION_ENDED, ended);
  }, []);

  if (checking) return <Loading label="Opening the console" />;
  if (!user) return <LoginForm onSignedIn={setUser} />;

  const items = NAV.filter((item) => !item.show || item.show(user));

  return (
    <SessionContext.Provider value={user}>
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col md:flex-row">
        <aside className="border-b border-border bg-surface md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 px-4 py-4 text-text-primary">
              <ShieldCheck aria-hidden className="size-5 text-mid-navy dark:text-accent" />
              <span className="font-bold">Qwench</span>
              <span className="text-sm text-text-secondary">Console</span>
            </div>

            <nav aria-label="Console" className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-1 md:flex-col md:overflow-visible">
              {items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-mid-navy",
                      active ? "bg-surface-alt text-text-primary" : "text-text-secondary hover:bg-surface-alt hover:text-text-primary",
                    )}
                  >
                    <Icon aria-hidden className="size-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 md:block">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{user.email}</p>
                <p className="truncate text-xs text-text-secondary">
                  {ROLE_LABEL[user.role]}, {user.organization}
                </p>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="flex min-h-10 shrink-0 items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-mid-navy md:mt-1"
              >
                <LogOut aria-hidden className="size-4" />
                Log out
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          {user.is_demo && (
            <p className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-secondary">
              <DemoTag />
              This account is for demonstrations. Its organisations and records are not real.
            </p>
          )}
          {children}
        </div>
      </div>
    </SessionContext.Provider>
  );
}
