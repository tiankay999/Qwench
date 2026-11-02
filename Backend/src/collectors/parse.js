import * as cheerio from "cheerio";

import { extract } from "../engine/extract.js";

/**
 * Reads regulators' notices into candidates for a person to approve. Pure functions.
 *
 * Everything here is deliberately cautious: anything uncertain goes to a person, no
 * date, link or quote is guessed, and payment numbers are never taken automatically
 * because notices also print the regulator's own numbers.
 */

const RELEVANT = {
  sec: /\bwarning\b|unlicen[sc]ed|without a licen[sc]e|scam alert|fraudulent|sandbox participants|menzgold|susu cash/i,
  bog: /unlicen[sc]ed|scam alert|fraudulent|illegal (?:operat|deposit|invest|lend)/i,
};
const NEVER = /tender|banknote|guideline|recruitment/i;

export const isRelevant = (collector, title) => !NEVER.test(title) && (RELEVANT[collector]?.test(title) ?? false);

const squash = (text) => String(text || "").replace(/\s+/g, " ").trim();

const NOT_A_NAME = /^(?:no\.?(?:\s|$)|number\b|name\b|tel\b|fax\b|email\b|road\b|castle road|annual report|p\.?o\.?\s*box)/i;
const looksLikeName = (name) => /[a-z]{2}/i.test(name) && name.length <= 80 && !NOT_A_NAME.test(name) && !/\b(?:road|street|avenue|report|tel:)\b/i.test(name);

/** A numbered list must run 1, 2, 3 with no gaps, or it isn't trusted. */
function inOrder(found) {
  const numbers = [...found.keys()].sort((a, b) => a - b);
  if (numbers.length < 2 || numbers[0] !== 1 || numbers.some((n, i) => n !== i + 1)) return [];
  const names = numbers.map((n) => found.get(n));
  return names.every(looksLikeName) ? names : [];
}

function fromTable(html) {
  const $ = cheerio.load(String(html));
  const found = new Map();
  $("tr").each((_, row) => {
    const cells = $(row).find("td, th").map((__, cell) => squash($(cell).text())).get();
    const number = cells[0]?.match(/^(\d{1,3})\.?$/)?.[1];
    if (number && cells[1]) found.set(Number(number), cells[1]);
  });
  return inOrder(found);
}

function fromLines(text) {
  const found = new Map();
  for (const line of String(text).split("\n")) {
    // A line can hold two columns: "1 Agile Loan 11 NovaCedi".
    for (const [, number, name] of line.matchAll(/(?:^|\s)(\d{1,3})\.?\s+([A-Za-z][^\d]*?)(?=\s+\d{1,3}\.?\s+[A-Za-z]|\s*$)/g)) {
      // An address such as "42 Castle Road" isn't a list item, and mustn't break the count.
      if (!found.has(Number(number)) && looksLikeName(squash(name))) found.set(Number(number), squash(name));
    }
  }
  return inOrder(found);
}

export function parseList({ html, text }) {
  const table = html ? fromTable(html) : [];
  return table.length ? table : fromLines(text || "");
}

const TITLE_PATTERNS = [
  /scam alert\s*[–—-]+\s*(.+)$/i,
  /warning against unlicen[sc]ed investment scheme\s*[–—-]+\s*(.+)$/i,
  /warning against (?!unauthori[sz]ed|unlicen[sc]ed)(.+?) platforms?\b/i,
  /warning (?:to the general public )?on (?!electronic|financial)(.+)$/i,
  /warning to investors regarding (.+)$/i,
  /public notice (?!on\b)(.+?) unlicen[sc]ed product/i,
  /public notice on (menzgold)$/i,
];

// "SCAM ALERT – RISE OF FRAUDULENT SCHEMES" names nobody. Reading that as a company
// would accuse someone of nothing, or something worse, so it goes to a person.
const GENERAL_WORDS = /\b(?:schemes?|fraudulent|rise of|advertisements?|the public|investors?|general)\b/i;

const decode = (text) => cheerio.load(`<i>${text}</i>`)("i").text();

/** Names stated in a notice's title, or nothing if the title isn't clear. */
export function namesFromTitle(rawTitle) {
  const title = squash(decode(rawTitle));
  for (const pattern of TITLE_PATTERNS) {
    const match = title.match(pattern);
    if (match) return match[1].split(/\s+and\s+/i).map(squash).filter((name) => name && !GENERAL_WORDS.test(name));
  }
  return [];
}

const SUFFIX = /\s+(?:ltd\.?|limited|plc|inc\.?|llc)$/i;

/** Other spellings a notice gives: "Expert (Expect) Option", "Infarms/Secure Farm". */
export function splitAliases(name) {
  const bracket = name.match(/^(.*?)\s*\(([^)]+)\)\s*(.*)$/);
  if (bracket) {
    const [, before, inside, after] = bracket;
    if (after) return [squash(`${before} ${after}`), squash(`${inside} ${after}`)];
    return [squash(before), squash(inside)];
  }
  if (name.includes("/")) return name.split("/").map(squash).filter(Boolean);
  return [];
}

function sandboxAliases(name) {
  const short = name.replace(SUFFIX, "");
  const core = short.replace(/\s+(?:ghana|gh)$/i, "");
  return [...new Set([short, core])].filter((a) => a !== name);
}

const MAX_QUOTE = 320;

const QUOTES = {
  warning: [
    /has NOT licen[sc]ed/,
    /\bis NOT licen[sc]ed/,
    /are operating without/i,
    /\bnot licen[sc]ed\b/i,
    /without the requisite licen[sc]e/i,
    /\bunlicen[sc]ed\b/i,
    /\bfraudulent\b/i,
    /\bscam\b/i,
  ],
  sandbox: [/sandbox participants/i, /admitted to pilot/i],
};

/** An exact sentence from the notice that says what it found, or nothing. */
export function documentQuote(text, recordType) {
  // Numbered lines are the list itself, not something to quote.
  const lines = String(text || "").split("\n").filter((line) => !/^\s*\d{1,3}\.?\s+[A-Za-z]/.test(line) && !/^\s*(?:no\.?|number)\s+.*\b(?:name|provider)\b/i.test(line));
  const flat = squash(lines.join(" "));
  const sentences = (flat.match(/[^.:!?]+(?:[.:!?]+(?=\s|$)|$)/g) || []).map((s) => s.trim());
  const usable = sentences.filter((s) => s.length <= MAX_QUOTE && !/notice no\b|^.?ensuring investor/i.test(s));
  for (const pattern of QUOTES[recordType] || []) {
    const hit = usable.find((s) => pattern.test(s));
    if (hit) return hit;
  }
  return null;
}

const LIST_TITLE = /\blist of\b|sandbox participants|unlicen[sc]ed digital credit/i;

const OWN_DOMAIN = /\.gov\.gh$|\.gov$|(?:^|\.)nic\.gh$/;

function noTables(html) {
  const $ = cheerio.load(String(html));
  $("table").remove();
  return $.text();
}

export function parseNotice({ collector, title, html, text }) {
  const decoded = squash(decode(title));
  const isSandbox = /sandbox/i.test(decoded);
  const recordType = isSandbox ? "sandbox" : "warning";
  const isLoanList = /digital credit|loan/i.test(decoded) || /loan app/i.test(text || "");

  // Numbered items are only names in a notice that says it's a list. Elsewhere they're
  // section headings or a table of something else, and reading those as companies would
  // accuse the wrong people. If in doubt, a person reads it.
  const isList = LIST_TITLE.test(decoded);
  const names = isList ? parseList({ html, text }) : namesFromTitle(decoded);

  const allText = `${text || ""}\n${html ? noTables(html) : ""}`;
  const websites = extract(squash(allText)).domains.filter((d) => !OWN_DOMAIN.test(d));
  const single = names.length === 1;

  const entities = names.map((name) => ({
    name,
    aliases: isSandbox ? sandboxAliases(name) : splitAliases(name),
    domains: single ? websites : [],
  }));

  const quote = documentQuote(allText, recordType);
  const note = !entities.length
    ? "No names could be read from this notice, so a person needs to read it."
    : !quote
      ? "No wording could be quoted from this notice, so a person needs to add it before anything can go live."
      : null;

  return {
    title: decoded,
    recordType,
    kind: isLoanList ? "app" : "platform",
    quote,
    entities,
    websitesForPerson: single ? [] : websites,
    note,
  };
}
