"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The watchlist, kept in this browser only.
 *
 * Qwench has no public sign-in, and a watchlist on the server would be a record
 * of what one person checked — exactly what rule 7 says not to keep. So it
 * holds names in localStorage, and the state beside each name is fetched live
 * when the dashboard loads. Nothing is sent anywhere.
 */

const KEY = "qwench:watchlist";
const CHANGED = "qwench:watchlist-changed";

export type Watched = { name: string; addedAt: string };

function read(): Watched[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((w) => typeof w?.name === "string") : [];
  } catch {
    // Private windows and blocked site data both land here. An empty list is fine.
    return [];
  }
}

function write(items: Watched[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Nothing depends on this persisting, so a failed write is not an error.
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function useWatchlist() {
  const [items, setItems] = useState<Watched[]>([]);
  // Starts false so the server and the first client render agree.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setItems(read());
    sync();
    setReady(true);
    window.addEventListener(CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const add = useCallback((name: string) => {
    const next = read();
    if (next.some((w) => w.name.toLowerCase() === name.toLowerCase())) return;
    write([{ name, addedAt: new Date().toISOString() }, ...next]);
  }, []);

  const remove = useCallback((name: string) => {
    write(read().filter((w) => w.name.toLowerCase() !== name.toLowerCase()));
  }, []);

  const has = useCallback(
    (name: string) => items.some((w) => w.name.toLowerCase() === name.toLowerCase()),
    [items],
  );

  return { items, ready, add, remove, has };
}
