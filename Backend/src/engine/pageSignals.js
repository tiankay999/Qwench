import crypto from "node:crypto";

import * as cheerio from "cheerio";

/**
 * Signs in a page's own code that it only looks like it works. Pure rules, with no AI,
 * and only ever reported as facts. A page's scripts and hidden parts aren't run, so
 * anything a script adds after loading can't be seen.
 */

const MIN_CONTROLS = 5;
const DEAD_SHARE = 0.6;
const MAX_SCRIPTS_FOR_STATIC = 1;
const MIN_TIMES = 3;
const SAME_TIME_SHARE = 0.75;
const MIN_CHAT_LINKS = 3;
const CHAT_SHARE = 0.5;

const RELATIVE_TIME = /\b(?:(?:\d+|an?)\s+(?:seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?)\s+ago|just now)\b/gi;
const CLOCK_TIME = /\b\d{1,2}:\d{2}\s?(?:am|pm)\b/gi;
const SHOWN_ADDRESS = /^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|gh|info|biz|xyz|top|online|site|app))(?:\/\S*)?$/i;
const CHAT_HOSTS = /^(?:wa\.me|t\.me|telegram\.me|(?:api|chat)\.whatsapp\.com)$/i;

const hostOf = (href) => {
  try {
    return /^https?:\/\//i.test(href) ? new URL(href).hostname.toLowerCase().replace(/^www\./, "") : null;
  } catch {
    return null;
  }
};

const sameSite = (a, b) => a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
const isDead = (href) => href === undefined || /^\s*(?:#.*|javascript:.*)?$/i.test(href);

/** A page's text with a space between elements, so "ago" and "I got" don't run together. */
export function spacedText($, root = "body") {
  return $(root)
    .find("*")
    .addBack()
    .contents()
    .filter((_, node) => node.type === "text")
    .map((_, node) => node.data)
    .get()
    .join(" ");
}

const NOTHING = { deadControls: false, mismatchedLink: false, oddLink: false, chatLinks: false, sameTimes: false, timeSignature: null };

export function pageSignals(html) {
  if (!html) return { ...NOTHING };

  const $ = cheerio.load(String(html));
  const scripts = $("script").length;
  $("script, style, noscript, template").remove();

  /* --- Links and buttons ---------------------------------------------- */
  const hrefs = $("a").map((_, el) => ({ href: $(el).attr("href"), text: $(el).text().trim() })).get();
  const forms = $("form").map((_, el) => $(el).attr("action")).get();
  const formCount = $("form").length;
  const looseButtons = $("button").filter((_, el) => $(el).closest("form").length === 0).length;

  const deadForms = formCount - forms.filter((action) => !isDead(action)).length;
  const dead = hrefs.filter((a) => isDead(a.href)).length + looseButtons + deadForms;
  const controls = hrefs.length + looseButtons + formCount;

  const deadControls = scripts <= MAX_SCRIPTS_FOR_STATIC && controls >= MIN_CONTROLS && dead / controls >= DEAD_SHARE;

  const outbound = hrefs.map((a) => ({ ...a, host: hostOf(a.href) })).filter((a) => a.host);

  const mismatchedLink = outbound.some(({ text, host }) => {
    const shown = text.match(SHOWN_ADDRESS)?.[1]?.toLowerCase().replace(/^www\./, "");
    return Boolean(shown) && !sameSite(shown, host);
  });

  const oddLink = outbound.some(({ host }) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.split(".").some((label) => label.startsWith("xn--")));

  const chats = outbound.filter(({ host }) => CHAT_HOSTS.test(host)).length;
  const chatLinks = chats >= MIN_CHAT_LINKS && chats / hrefs.length >= CHAT_SHARE;

  /* --- Comment times --------------------------------------------------- */
  const text = spacedText($);
  const relative = (text.match(RELATIVE_TIME) || []).map((t) => t.toLowerCase().replace(/\s+/g, " "));
  const clock = (text.match(CLOCK_TIME) || []).map((t) => t.toLowerCase().replace(/\s+/g, ""));
  const times = [...relative, ...clock];

  const counts = times.reduce((all, t) => all.set(t, (all.get(t) || 0) + 1), new Map());
  const most = Math.max(0, ...counts.values());
  const sameTimes = times.length >= MIN_TIMES && most / times.length >= SAME_TIME_SHARE;

  // Real relative times change between visits. A hash, so no page text is kept.
  const timeSignature = relative.length ? crypto.createHash("sha256").update(relative.join("|")).digest("hex") : null;

  return { deadControls, mismatchedLink, oddLink, chatLinks, sameTimes, timeSignature };
}
