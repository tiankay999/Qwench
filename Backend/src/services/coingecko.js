import axios from "axios";

const BASE = "https://api.coingecko.com/api/v3";
const TIMEOUT = 7000;

// Tiny in-memory cache so a demo with repeated queries does not get rate limited.
const cache = new Map();
const TTL_MS = 10 * 60 * 1000;

/**
 * Look a token up on CoinGecko (free, no API key).
 * Returns null when the token does not exist or the API is unreachable.
 */
export async function lookupToken(query) {
  const key = String(query).toLowerCase().trim();
  if (!key) return null;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    console.log(`[coingecko] cache hit for "${key}"`);
    return hit.value;
  }

  try {
    console.log(`[coingecko] searching for "${key}"`);
    const search = await axios.get(`${BASE}/search`, {
      params: { query: key },
      timeout: TIMEOUT,
    });

    const coin = search.data?.coins?.[0];
    if (!coin) {
      console.log(`[coingecko] no token found for "${key}"`);
      cache.set(key, { at: Date.now(), value: null });
      return null;
    }

    const detail = await axios.get(`${BASE}/coins/${coin.id}`, {
      params: {
        localization: false,
        tickers: false,
        community_data: false,
        developer_data: false,
      },
      timeout: TIMEOUT,
    });

    const d = detail.data;
    const value = {
      id: d.id,
      name: d.name,
      symbol: String(d.symbol || "").toUpperCase(),
      marketCapRank: d.market_cap_rank ?? null,
      marketCapUsd: d.market_data?.market_cap?.usd ?? 0,
      priceUsd: d.market_data?.current_price?.usd ?? 0,
      genesisDate: d.genesis_date ?? null,
      homepage: d.links?.homepage?.[0] || "",
      exchangeCount: d.tickers?.length ?? null,
    };

    console.log(
      `[coingecko] found ${value.name} (${value.symbol}) rank=${value.marketCapRank} mcap=$${value.marketCapUsd}`
    );
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    console.warn(`[coingecko] lookup failed for "${key}": ${err.message}`);
    return null;
  }
}
