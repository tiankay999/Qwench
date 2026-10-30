import axios from "axios";

const BASE = "https://api.coingecko.com/api/v3";
const TIMEOUT = 8000;

/**
 * Returned instead of null when CoinGecko could not be reached (rate limit,
 * timeout, outage). The difference matters: "not found" is evidence a token is
 * fake, "unavailable" is not, and must never be reported as a red flag.
 */
export const UNAVAILABLE = Symbol("coingecko-unavailable");

// CoinGecko's free tier allows ~30 requests/minute, and each token lookup costs
// two calls. Keep a gap between calls so a burst of WhatsApp messages cannot
// get us rate limited.
const MIN_GAP_MS = 2600;
let lastCall = 0;
let queue = Promise.resolve();

function throttled(fn) {
  queue = queue.then(async () => {
    const wait = Math.max(0, lastCall + MIN_GAP_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  return queue;
}

// Short-lived cache so repeated demo queries do not burn the rate limit.
const cache = new Map();
const TTL_MS = 10 * 60 * 1000;

function cached(key, producer) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    console.log(`[coingecko] cache hit for "${key}"`);
    return Promise.resolve(hit.value);
  }
  return producer().then((value) => {
    // Never cache a failed lookup -- a rate limit now must not look like a
    // missing token for the next ten minutes.
    if (value !== UNAVAILABLE) cache.set(key, { at: Date.now(), value });
    return value;
  });
}

async function get(path, params = {}, retryOn429 = true) {
  return throttled(async () => {
    try {
      const { data } = await axios.get(`${BASE}${path}`, { params, timeout: TIMEOUT });
      return data;
    } catch (err) {
      if (err.response?.status === 429 && retryOn429) {
        console.warn("[coingecko] rate limited, backing off 6s then retrying once");
        await new Promise((r) => setTimeout(r, 6000));
        const { data } = await axios.get(`${BASE}${path}`, { params, timeout: TIMEOUT });
        return data;
      }
      throw err;
    }
  });
}

/**
 * GET /search?query= then GET /coins/{id}
 * Returns the market signals the risk engine scores on, or null if the token
 * does not exist / the API is unreachable.
 */
export async function lookupToken(query) {
  const key = String(query).toLowerCase().trim();
  if (!key) return null;

  return cached(`token:${key}`, async () => {
    try {
      console.log(`[coingecko] GET /search?query=${key}`);
      const search = await get("/search", { query: key });

      const coin = search?.coins?.[0];
      if (!coin) {
        console.log(`[coingecko] no token found for "${key}"`);
        return null;
      }

      console.log(`[coingecko] GET /coins/${coin.id}`);
      const d = await get(`/coins/${coin.id}`, {
        localization: false,
        tickers: true,
        market_data: true,
        community_data: true,
        developer_data: false,
      });

      const md = d.market_data || {};
      const links = d.links || {};
      const homepage = (links.homepage || []).find(Boolean) || "";
      const socials = [
        links.twitter_screen_name,
        links.telegram_channel_identifier,
        links.subreddit_url,
        (links.chat_url || []).find(Boolean),
        (links.official_forum_url || []).find(Boolean),
      ].filter(Boolean);

      const genesisDate = d.genesis_date || null;
      const ageDays = genesisDate ? Math.floor((Date.now() - new Date(genesisDate).getTime()) / 86_400_000) : null;

      const value = {
        id: d.id,
        name: d.name,
        symbol: String(d.symbol || "").toUpperCase(),
        marketCapRank: d.market_cap_rank ?? null,
        marketCapUsd: md.market_cap?.usd ?? 0,
        volume24hUsd: md.total_volume?.usd ?? 0,
        priceUsd: md.current_price?.usd ?? 0,
        priceChange24h: md.price_change_percentage_24h ?? null,
        genesisDate,
        ageDays,
        homepage,
        socialCount: socials.length,
        hasDescription: Boolean(d.description?.en?.trim()),
        exchangeCount: Array.isArray(d.tickers) ? new Set(d.tickers.map((t) => t.market?.name)).size : 0,
        // Contract addresses, when the token is not a native chain coin
        platforms: Object.entries(d.platforms || {}).filter(([, addr]) => addr),
      };

      console.log(
        `[coingecko] ${value.name} (${value.symbol}) rank=${value.marketCapRank} mcap=$${value.marketCapUsd} vol24h=$${value.volume24hUsd} age=${value.ageDays}d exchanges=${value.exchangeCount}`
      );
      return value;
    } catch (err) {
      const status = err.response?.status;
      console.warn(`[coingecko] lookup failed for "${key}": ${status ? `HTTP ${status} -- ` : ""}${err.message}`);
      // Could not check -- explicitly NOT the same as "this token is fake".
      return UNAVAILABLE;
    }
  });
}

/** GET /coins/markets -- top coins by market cap. */
export async function getTopMarkets(limit = 100) {
  return cached(`markets:${limit}`, async () => {
    try {
      console.log(`[coingecko] GET /coins/markets (top ${limit})`);
      const data = await get("/coins/markets", {
        vs_currency: "usd",
        order: "market_cap_desc",
        per_page: Math.min(limit, 250),
        page: 1,
        sparkline: false,
      });
      return (data || []).map((c) => ({
        id: c.id,
        name: c.name,
        symbol: String(c.symbol || "").toUpperCase(),
        marketCapRank: c.market_cap_rank,
        marketCapUsd: c.market_cap,
        priceUsd: c.current_price,
      }));
    } catch (err) {
      console.warn(`[coingecko] markets failed: ${err.message}`);
      return [];
    }
  });
}

/** GET /search/trending -- what the market is currently looking at. */
export async function getTrendingCoins() {
  return cached("trending", async () => {
    try {
      console.log("[coingecko] GET /search/trending");
      const data = await get("/search/trending");
      return (data?.coins || []).map(({ item }) => ({
        id: item.id,
        name: item.name,
        symbol: String(item.symbol || "").toUpperCase(),
        marketCapRank: item.market_cap_rank ?? null,
        priceUsd: item.data?.price ?? null,
      }));
    } catch (err) {
      console.warn(`[coingecko] trending failed: ${err.message}`);
      return [];
    }
  });
}
