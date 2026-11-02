import crypto from "node:crypto";

import { hashSender } from "../lib/identifiers.js";
import { SenderDay } from "../models/index.js";
import { sendError } from "./errorHandler.js";

const BOT_CHANNELS = new Set(["whatsapp", "telegram"]);
const DEFAULT_DAILY_LIMIT = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

/** True when the request carries the shared bot key. Fails closed if none is set. */
export function hasChannelKey(req) {
  const expected = (process.env.CHANNEL_API_KEY || "").trim();
  const given = req.headers["x-channel-key"];
  if (!expected || typeof given !== "string") return false;

  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/** Bots must prove who they are. The web app has no key, and is limited by IP. */
export function channelAuth(req, res, next) {
  const channel = req.body?.channel || "web";
  if (BOT_CHANNELS.has(channel) && !hasChannelKey(req)) {
    return sendError(res, 401, "invalid_channel_key", "A valid X-Channel-Key is required for this channel");
  }
  req.channel = channel;
  return next();
}

function dailyLimit() {
  const limit = Number(process.env.PUBLIC_DAILY_LIMIT);
  return Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_DAILY_LIMIT;
}

async function countToday(senderHash, now) {
  const day = now.toISOString().slice(0, 10);
  const update = () =>
    SenderDay.findOneAndUpdate(
      { senderHash, day },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + DAY_MS) } },
      { upsert: true, returnDocument: "after" }
    ).lean();

  try {
    return await update();
  } catch (err) {
    // Two first requests at once: one insert loses, and the retry finds its row.
    if (err.code === 11000) return update();
    throw err;
  }
}

/**
 * The fair-use limit for bots. sender_ref is hashed here with a daily salt and used
 * for nothing else: check_events holds no sender, so nothing links a person to what
 * they checked.
 */
export async function fairUse(req, res, next) {
  if (!BOT_CHANNELS.has(req.channel)) return next();

  const senderHash = hashSender(req.body?.sender_ref);
  if (!senderHash) return sendError(res, 400, "invalid_input", "Invalid input: sender_ref is required for this channel");

  try {
    const { count } = await countToday(senderHash, new Date());
    if (count > dailyLimit()) return sendError(res, 429, "daily_limit", "Daily limit reached. Try again tomorrow.");
    return next();
  } catch (err) {
    return next(err);
  }
}
