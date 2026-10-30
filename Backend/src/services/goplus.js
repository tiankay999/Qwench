import axios from "axios";

const BASE = "https://api.gopluslabs.io/api/v1";
const TIMEOUT = 9000;

// Users rarely say which chain an address is on, so probe the common ones.
const CHAINS = [
  { id: "1", name: "Ethereum" },
  { id: "56", name: "BSC" },
  { id: "137", name: "Polygon" },
];

const cache = new Map();
const TTL_MS = 15 * 60 * 1000;

export const CONTRACT_RE = /^0x[a-fA-F0-9]{40}$/;

export function isContractAddress(text = "") {
  return CONTRACT_RE.test(String(text).trim());
}

/** GoPlus returns "1"/"0"/"" strings rather than booleans. */
const yes = (v) => v === "1" || v === 1 || v === true;

/**
 * GET /token_security/{chain_id}?contract_addresses={address}
 * Tries Ethereum, then BSC, then Polygon, and returns the first chain that
 * actually knows the address. Returns null when no chain recognises it.
 */
export async function checkContract(address) {
  const addr = String(address).trim().toLowerCase();
  if (!isContractAddress(addr)) return null;

  const hit = cache.get(addr);
  if (hit && Date.now() - hit.at < TTL_MS) {
    console.log(`[goplus] cache hit for ${addr}`);
    return hit.value;
  }

  for (const chain of CHAINS) {
    try {
      console.log(`[goplus] GET /token_security/${chain.id} for ${addr}`);
      const { data } = await axios.get(`${BASE}/token_security/${chain.id}`, {
        params: { contract_addresses: addr },
        timeout: TIMEOUT,
      });

      const result = data?.result?.[addr];
      // An unknown address comes back as an empty object on that chain.
      if (!result || Object.keys(result).length === 0) {
        console.log(`[goplus] ${addr} not found on ${chain.name}`);
        continue;
      }

      const value = {
        address: addr,
        chainId: chain.id,
        chainName: chain.name,
        tokenName: result.token_name || "",
        tokenSymbol: String(result.token_symbol || "").toUpperCase(),
        holderCount: Number(result.holder_count) || null,

        // The six checks we score on
        isHoneypot: yes(result.is_honeypot),
        isOpenSource: yes(result.is_open_source),
        canTakeBackOwnership: yes(result.can_take_back_ownership),
        ownerChangeBalance: yes(result.owner_change_balance),
        hiddenOwner: yes(result.hidden_owner),
        selfdestruct: yes(result.selfdestruct),

        // Useful extras GoPlus returns alongside them
        isProxy: yes(result.is_proxy),
        isMintable: yes(result.is_mintable),
        transferPausable: yes(result.transfer_pausable),
        isBlacklisted: yes(result.is_blacklisted),
        buyTax: result.buy_tax ?? null,
        sellTax: result.sell_tax ?? null,
      };

      console.log(
        `[goplus] ${addr} on ${chain.name}: honeypot=${value.isHoneypot} openSource=${value.isOpenSource} hiddenOwner=${value.hiddenOwner}`
      );
      cache.set(addr, { at: Date.now(), value });
      return value;
    } catch (err) {
      const status = err.response?.status;
      console.warn(`[goplus] ${chain.name} check failed: ${status ? `HTTP ${status} -- ` : ""}${err.message}`);
    }
  }

  console.log(`[goplus] ${addr} not recognised on any supported chain`);
  cache.set(addr, { at: Date.now(), value: null });
  return null;
}

/**
 * Turn a GoPlus result into scored red flags.
 * Returns { points, flags, greenFlags } -- points are capped by the caller.
 */
export function scoreContract(sec) {
  const flags = [];
  const greenFlags = [];
  let points = 0;

  if (sec.isHoneypot) {
    points += 6;
    flags.push("🍯 HONEYPOT: the contract lets you buy but blocks you from selling");
  }

  if (!sec.isOpenSource) {
    points += 2;
    flags.push("Contract source code is not published -- nobody can audit what it does");
  } else {
    greenFlags.push("Contract source code is published and verifiable");
  }

  if (sec.hiddenOwner) {
    points += 2;
    flags.push("Contract has a hidden owner -- control is concealed");
  }

  if (sec.canTakeBackOwnership) {
    points += 1.5;
    flags.push("Ownership can be reclaimed after being renounced");
  }

  if (sec.ownerChangeBalance) {
    points += 2.5;
    flags.push("The owner can change your balance -- they can zero out your holding");
  }

  if (sec.selfdestruct) {
    points += 2.5;
    flags.push("Contract can self-destruct, taking the token with it");
  }

  if (sec.transferPausable) {
    points += 1;
    flags.push("Transfers can be paused by the owner at any time");
  }

  if (sec.isBlacklisted) {
    points += 1;
    flags.push("Contract can blacklist wallets, blocking them from selling");
  }

  const sellTax = Number(sec.sellTax);
  if (Number.isFinite(sellTax) && sellTax >= 0.1) {
    points += 1;
    flags.push(`Sell tax of ${(sellTax * 100).toFixed(0)}% is taken from every sale`);
  }

  if (!flags.length) greenFlags.push("No dangerous contract permissions detected by GoPlus");

  return { points, flags, greenFlags };
}
