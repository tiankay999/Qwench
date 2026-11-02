/**
 * The Qwench register, as published by SEC Ghana, the Bank of Ghana and EOCO.
 *
 * Kept as data rather than inline in the seed script so the two can be reviewed
 * separately: this file is what a compliance reader checks, seed.js is how it
 * gets into MongoDB.
 *
 * Every entity here must be traceable to one of the sources below. Nothing is
 * added from reviews, news reports, or scraped social media.
 */

export const SOURCES = [
  {
    key: "sec_notice_2025",
    publisher: "SEC Ghana",
    type: "notice",
    title: "Public Notice on Fraudulent and Suspicious Investment Schemes (SEC/PN/002/07/2025)",
    url: "https://sec.gov.gh/public-notices/",
    publishedOn: "2025-07-15",
    isOfficial: true,
  },
  {
    key: "sec_eoco_joint",
    publisher: "SEC Ghana",
    type: "notice",
    title: "SEC Ghana & EOCO Joint Warning on Unlicensed Investment Schemes",
    url: "https://sec.gov.gh/public-notices/",
    publishedOn: "2024-06-01",
    isOfficial: true,
  },
  {
    key: "sec_register",
    publisher: "SEC Ghana",
    type: "register",
    title: "SEC Ghana Licensed Market Operators Register",
    url: "https://sec.gov.gh/licensed-market-operators/",
    publishedOn: "2025-01-01",
    isOfficial: true,
  },
  {
    key: "sec_sandbox",
    publisher: "SEC Ghana",
    type: "notice",
    title: "SEC Ghana Virtual Asset Regulatory Sandbox Participants",
    url: "https://sec.gov.gh/",
    publishedOn: "2025-06-01",
    isOfficial: true,
  },
  {
    key: "bog_notice",
    publisher: "Bank of Ghana",
    type: "notice",
    title: "Bank of Ghana Warning on Unlicensed Digital Lenders and Investment Platforms",
    url: "https://bog.gov.gh/",
    publishedOn: "2025-01-01",
    isOfficial: true,
  },
  {
    key: "sec_historical",
    publisher: "SEC Ghana",
    type: "notice",
    title: "Historical SEC Ghana Enforcement Actions",
    url: "https://sec.gov.gh/",
    publishedOn: "2023-01-01",
    isOfficial: true,
  },
  {
    key: "gov_bodies",
    publisher: "Government of Ghana",
    type: "register",
    title: "Ghanaian Financial Regulators and Market Infrastructure",
    url: "https://sec.gov.gh/",
    publishedOn: "2025-01-01",
    isOfficial: true,
  },
];

/**
 * Regulators, government bodies and market infrastructure.
 *
 * These are NOT investments and must never be risk-assessed as if they were.
 * Qwench tells people to verify with SEC Ghana, so returning a warning for SEC
 * Ghana itself would undermine every other message it sends. They carry a
 * `registration` record, which the evidence engine reads as the legal state
 * "registered" and the bot renders as an information card.
 */
export const AUTHORITIES = [
  {
    name: "Securities and Exchange Commission Ghana",
    slug: "sec-ghana",
    kind: "authority",
    aliases: ["SEC", "SEC Ghana", "SEC GH", "Securities and Exchange Commission"],
  },
  { name: "Bank of Ghana", slug: "bank-of-ghana", kind: "authority", aliases: ["BoG", "Central Bank of Ghana"] },
  {
    name: "Economic and Organised Crime Office",
    slug: "eoco",
    kind: "authority",
    aliases: ["EOCO", "Economic and Organized Crime Office"],
  },
  {
    name: "National Pensions Regulatory Authority",
    slug: "npra",
    kind: "authority",
    aliases: ["NPRA"],
  },
  { name: "National Insurance Commission", slug: "nic-ghana", kind: "authority", aliases: ["NIC"] },
  { name: "Ghana Stock Exchange", slug: "gse", kind: "authority", aliases: ["GSE"] },
  {
    name: "Financial Intelligence Centre Ghana",
    slug: "fic-ghana",
    kind: "authority",
    aliases: ["FIC", "Financial Intelligence Centre"],
  },
];

/** SEC Ghana public notice, July 2025 — 23 entities. */
export const SEC_BLACKLISTED_2025 = [
  { name: "Afri Hub", slug: "afri-hub", kind: "platform", aliases: ["AfriHub"] },
  { name: "BG Wealth", slug: "bg-wealth", kind: "platform", aliases: [] },
  { name: "BP Investment", slug: "bp-investment", kind: "company", aliases: ["BP Invest"] },
  {
    name: "Creative Walker Promotion Company",
    slug: "cwpc",
    kind: "company",
    aliases: ["CWPC", "Creative Walker"],
  },
  // "Dallmayr" is also a real German coffee house. The scheme takes a distinct
  // slug, and exact matching only, so the two are never conflated.
  { name: "Dallmayr", slug: "dallmayr-scheme", kind: "platform", aliases: [], protectedName: true },
  { name: "Expert Option", slug: "expert-option", kind: "platform", aliases: ["Expect Option"] },
  { name: "GAIP Securities Learning & Exchange Group", slug: "gaip-securities", kind: "platform", aliases: ["GAIP"] },
  { name: "Ghana Vest", slug: "ghana-vest", kind: "platform", aliases: ["GhanaVest"] },
  { name: "Harvest Fund", slug: "harvest-fund", kind: "platform", aliases: [] },
  { name: "Infarms", slug: "infarms", kind: "platform", aliases: ["Secure Farm", "SecureFarm"] },
  { name: "Kukafor Platform", slug: "kukafor", kind: "platform", aliases: ["Kukafor"] },
  { name: "Mazzuma", slug: "mazzuma", kind: "platform", aliases: [] },
  { name: "Medisyne Trade", slug: "medisyne-trade", kind: "platform", aliases: ["Medisyne"] },
  { name: "NIO Platform", slug: "nio-platform", kind: "platform", aliases: ["NIO"] },
  { name: "Profit Rise Invest", slug: "profit-rise-invest", kind: "platform", aliases: ["ProfitRise"] },
  { name: "Quant Vest Stock Exchange", slug: "qvse", kind: "platform", aliases: ["QVSE", "Quant Vest"] },
  { name: "QVES", slug: "qves", kind: "platform", aliases: [] },
  { name: "QX Broker", slug: "qx-broker", kind: "platform", aliases: ["Qumatix", "QX"] },
  { name: "Smart Gain", slug: "smart-gain", kind: "platform", aliases: ["SmartGain"] },
  { name: "Yepbit Trading", slug: "yepbit", kind: "platform", aliases: ["YepBit", "Yepbit"] },
  { name: "ZEC ZEC FX", slug: "zec-zec-fx", kind: "platform", aliases: ["ZECZEC", "ZEC FX"] },
  { name: "Bonchat", slug: "bonchat", kind: "platform", aliases: [] },
  { name: "Ultima Cryptocurrency Group", slug: "ultima-crypto", kind: "platform", aliases: ["Ultima"] },
];

/** SEC Ghana & EOCO joint warning — 17 entities. */
export const SEC_EOCO_WARNED = [
  {
    name: "PatronPay Ghana",
    slug: "patronpay",
    kind: "platform",
    aliases: ["PetronPay Ghana", "PetronPay", "PatronPay"],
  },
  { name: "Cedi Network Ghana", slug: "cedi-network", kind: "platform", aliases: ["CediNetwork"] },
  { name: "Bitcash Investment", slug: "bitcash", kind: "platform", aliases: ["BitCash"] },
  { name: "Solmax Group", slug: "solmax", kind: "company", aliases: ["Solmax"] },
  { name: "Freedom Synergy", slug: "freedom-synergy", kind: "company", aliases: [] },
  { name: "FxKash Investment", slug: "fxkash", kind: "platform", aliases: ["FxKash", "FX Kash"] },
  { name: "Binomo Investment", slug: "binomo-investment", kind: "platform", aliases: ["Binomo"] },
  { name: "Hi Pay", slug: "hi-pay", kind: "platform", aliases: ["HiPay"] },
  { name: "Quick Earn", slug: "quick-earn", kind: "platform", aliases: ["QuickEarn"] },
  { name: "Lite Earn", slug: "lite-earn", kind: "platform", aliases: ["LiteEarn"] },
  { name: "Snap Finance", slug: "snap-finance", kind: "platform", aliases: [] },
  { name: "Faucet Wealth Investment", slug: "faucet-wealth", kind: "platform", aliases: ["Faucet Wealth"] },
  { name: "Opay Investment", slug: "opay-investment", kind: "platform", aliases: ["OPay Investment"] },
  { name: "Payme Financial Services", slug: "payme-financial", kind: "platform", aliases: ["PayMe"] },
  { name: "Passive Income", slug: "passive-income", kind: "platform", aliases: [] },
  { name: "Yvonne Hanson Deals", slug: "yvonne-hanson", kind: "company", aliases: [] },
  { name: "Alpha Pay", slug: "alpha-pay", kind: "platform", aliases: ["AlphaPay"] },
];

/** Well-known historical Ghanaian schemes, closed. */
export const HISTORICAL_SCAMS = [
  { name: "Menzgold Ghana Limited", slug: "menzgold", kind: "company", aliases: ["Menzgold", "MenzGold"] },
  { name: "DKM Diamond Microfinance", slug: "dkm-diamond", kind: "company", aliases: ["DKM"] },
  { name: "God is Love Fun Club", slug: "god-is-love", kind: "company", aliases: [] },
  { name: "Hus-Pet", slug: "hus-pet", kind: "company", aliases: ["HusPet"] },
  { name: "Gem Gold", slug: "gem-gold", kind: "company", aliases: ["GemGold"] },
  { name: "Brew Marketing Consult", slug: "brew-marketing", kind: "company", aliases: [] },
  { name: "Mekanism Marketing Ltd", slug: "mekanism", kind: "company", aliases: ["Mekanism"] },
];

/** Named in more than one regulator's notice. */
export const DUAL_SOURCE_CASES = [
  {
    name: "Daily Wealth Guide",
    slug: "daily-wealth-guide",
    kind: "platform",
    aliases: ["DailyWealthGuide", "Daily Wealth"],
    sourceKeys: ["sec_notice_2025", "bog_notice"],
  },
];

/** A scheme trading on a real brand's name. */
export const IMPERSONATION_CASES = [
  { name: "Darazz", slug: "darazz", kind: "platform", aliases: [], sourceKey: "sec_eoco_joint" },
];

/**
 * Real businesses that share a name with something in a notice.
 *
 * They exist in the register ONLY so an impersonator can be linked to them.
 * They carry no warning record, and every identifier is exact-match only, so a
 * near miss can never pull a legitimate global brand into a Ghanaian notice.
 */
export const PROTECTED_COMPANIES = [
  { name: "Daraz", slug: "daraz-ecommerce", kind: "company", country: "PK", aliases: [], protectedName: true },
  { name: "Hut 8", slug: "hut-8-mining", kind: "company", country: "CA", aliases: ["Hut 8 Mining", "Hut8"], protectedName: true },
  { name: "Dallmayr", slug: "dallmayr-coffee", kind: "company", country: "DE", aliases: ["Alois Dallmayr"], protectedName: true },
];

/** SEC Ghana licensed market operators — 15 entities. */
export const LICENSED_ENTITIES = [
  { name: "Databank Financial Services", slug: "databank", kind: "company", licenseType: "Fund Manager", aliases: ["Databank"] },
  { name: "Black Star Advisors", slug: "black-star-advisors", kind: "company", licenseType: "Fund Manager", aliases: [] },
  { name: "EDC Investments", slug: "edc-investments", kind: "company", licenseType: "Fund Manager", aliases: ["EDC"] },
  { name: "Gold Coast Fund Management", slug: "gold-coast-fund", kind: "company", licenseType: "Fund Manager", aliases: [] },
  { name: "IC Securities", slug: "ic-securities", kind: "company", licenseType: "Broker-Dealer", aliases: [] },
  { name: "Fidelity Securities", slug: "fidelity-securities", kind: "company", licenseType: "Broker-Dealer", aliases: [] },
  { name: "SAS Finance Group", slug: "sas-finance", kind: "company", licenseType: "Fund Manager", aliases: ["SAS"] },
  { name: "CDH Financial Holdings", slug: "cdh-financial", kind: "company", licenseType: "Fund Manager", aliases: ["CDH"] },
  { name: "Petra Trust Company", slug: "petra-trust", kind: "company", licenseType: "Fund Manager", aliases: ["Petra Trust"] },
  { name: "First Fund", slug: "first-fund", kind: "company", licenseType: "Fund Manager", aliases: [] },
  { name: "HFC Investments", slug: "hfc-investments", kind: "company", licenseType: "Fund Manager", aliases: ["HFC"] },
  { name: "Strategic African Securities", slug: "strategic-african", kind: "company", licenseType: "Broker-Dealer", aliases: [] },
  { name: "Merban Stockbrokers", slug: "merban", kind: "company", licenseType: "Broker-Dealer", aliases: ["Merban"] },
  { name: "CAL Brokers", slug: "cal-brokers", kind: "company", licenseType: "Broker-Dealer", aliases: [] },
  { name: "Stanbic Investment Management Services", slug: "stanbic-ims", kind: "company", licenseType: "Fund Manager", aliases: ["Stanbic IMS"] },
];

const VASP = "Virtual Asset Service Provider (Sandbox)";

/**
 * SEC Ghana virtual asset sandbox — 11 participants.
 *
 * Provisional approval for a 12-month window, never a full licence.
 */
export const SANDBOX_PARTICIPANTS = [
  { name: "AFRICOIN", slug: "africoin", kind: "platform", licenseType: VASP, aliases: [] },
  { name: "BLU PENGUIN", slug: "blu-penguin", kind: "platform", licenseType: VASP, aliases: ["BluPenguin"] },
  { name: "GOLDBOD", slug: "goldbod", kind: "platform", licenseType: VASP, aliases: [] },
  { name: "HANYPAY", slug: "hanypay", kind: "platform", licenseType: VASP, aliases: [] },
  { name: "HYRO EXCHANGE GH LTD", slug: "hyro-exchange", kind: "platform", licenseType: VASP, aliases: ["Hyro Exchange"] },
  { name: "HSB GLOBAL", slug: "hsb-global", kind: "platform", licenseType: VASP, aliases: [] },
  { name: "KOINKOIN", slug: "koinkoin", kind: "platform", licenseType: VASP, aliases: [] },
  { name: "WHITEBITS", slug: "whitebits", kind: "platform", licenseType: VASP, aliases: [] },
  { name: "VAULTA", slug: "vaulta", kind: "platform", licenseType: VASP, aliases: [] },
  { name: "XCHAIN", slug: "xchain", kind: "platform", licenseType: VASP, aliases: [] },
  { name: "BSYSTEM LTD", slug: "bsystem", kind: "platform", licenseType: VASP, aliases: ["BSystem"] },
];

export const SANDBOX_WINDOW = { effectiveOn: "2025-06-01", endsOn: "2026-06-01" };

/** Impersonator -> the real business whose name is being used. */
export const IMPERSONATION_RELATIONS = [
  { from: "dallmayr-scheme", to: "dallmayr-coffee", type: "impersonates" },
  { from: "darazz", to: "daraz-ecommerce", type: "impersonates" },
];

export const ORGANISATIONS = [
  { name: "Qwench", type: "qwench", status: "active", isDemo: false },
  // Labelled demo so its data can never be mistaken for a real institution's.
  { name: "Demo Bank", type: "bank", status: "demo", isDemo: true },
];
