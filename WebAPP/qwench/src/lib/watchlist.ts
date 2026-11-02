"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The watchlist, kept in this browser only.
 *
 * Qwench has no public sign-in, and a watchlist on the server would be a record
 * of what one person checked — exactly what rule 7 says not to keep. So it
 * holds names in localStorage, and the state beside each name is fetched live
 * when the dashboard loads. Nothing is sent anywhere.
 *
 * Read through useSyncExternalStore rather than an effect, so every component
 * watching the list re-renders from one source when it changes — including
 * changes made in another tab.
 */

const KEY = "qwench:watchlist";
const CHANGED = "qwench:watchlist-changed";

export type Watched = { name: string; addedAt: string };

const EMPTY: Watched[] = [];

/**
 * getSnapshot has to return the same array until the stored value actually
 * changes, or React re-renders forever. So the last raw string and its parsed
 * form are kept side by side, and parsing only happens when the raw differs.
 */
let lastRaw: string | null = null;
let lastParsed: Watched[] = EMPTY;

function snapshot(): Watched[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    // Private windows and blocked site data both land here.
    return EMPTY;
  }

  if (raw === lastRaw) return lastParsed;
  lastRaw = raw;

  try {
    const parsed = raw ? JSON.parse(raw) : EMPTY;
    lastParsed = Array.isArray(parsed)
      ? parsed.filter((w): w is Watched => typeof w?.name === "string")
      : EMPTY;
  } catch {
    lastParsed = EMPTY;
  }
  return lastParsed;
}

/** Nothing is readable while rendering on the server. */
const serverSnapshot = (): Watched[] => EMPTY;

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(items: Watched[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Nothing depends on this persisting, so a failed write is not an error.
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** True once this is running in the browser, so the UI can hold off one render. */
const hydrated = () => true;
const notHydrated = () => false;

export function useWatchlist() {
  const items = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const ready = useSyncExternalStore(subscribe, hydrated, notHydrated);

  const add = useCallback((name: string) => {
    const current = snapshot();
    if (current.some((w) => w.name.toLowerCase() === name.toLowerCase())) return;
    write([{ name, addedAt: new Date().toISOString() }, ...current]);
  }, []);

  const remove = useCallback((name: string) => {
    write(snapshot().filter((w) => w.name.toLowerCase() !== name.toLowerCase()));
  }, []);

  const has = useCallback(
    (name: string) => items.some((w) => w.name.toLowerCase() === name.toLowerCase()),
    [items],
  );

  return { items, ready, add, remove, has };
}
