// QWENCH API RULES — NEVER return any of these in any response:
// - Risk scores or risk verdicts
// - Risk colors
// - Recommendations or advice text
// - Community boost scores
// - Identity of who contributed data
// - Identity of who performed a check
// - Raw phone numbers or message text
// Sandbox, licensed, and authority results are LEGAL STATES, never warnings.

import { Router } from "express";

import { checkRules } from "../middleware/validate.js";
import { allowedUse, performCheck } from "../services/checkService.js";
import { logCheck } from "../utils/logCheck.js";

const router = Router();

const VALID_CHANNELS = ["whatsapp", "telegram", "web", "api"];

/**
 * POST /v1/public/check
 *
 * The main endpoint: WhatsApp bot, Telegram bot, and the web paste box.
 */
router.post("/check", checkRules, async (req, res, next) => {
  const { recipient, type, new_payee: newPayee = false } = req.body;
  const channel = VALID_CHANNELS.includes(req.headers["x-channel"]) ? req.headers["x-channel"] : "web";
  const checkedAt = new Date().toISOString();

  try {
    const result = await performCheck({ recipient, type, newPayee });

    // The sender is hashed inside logCheck with a daily-rotating salt and
    // cleared after 24h; the raw value never reaches the database.
    await logCheck({
      channel,
      inputType: inputTypeFor(type),
      identifierHashes: [result.valueHash],
      matchedEntityIds: result.entity ? [result.entity._id] : [],
      state: result.state,
      tier: result.tier,
      flags: result.reasonCodes || [],
      sender: req.headers["x-sender"],
      outcome: result.suggestedAction,
    });

    if (!result.match) {
      return res.json({ match: false, checked_at: checkedAt });
    }

    return res.json({
      match: true,
      entity: result.entity.name,
      state: result.state,
      tier: result.tier,
      reason_codes: result.reasonCodes,
      sources: result.records
        .filter((r) => r.sourceId)
        .map((r) => ({
          publisher: r.sourceId.publisher,
          date: r.sourceId.publishedOn,
          url: r.sourceId.url || null,
        })),
      allowed_use: allowedUse(result.tier),
      suggested_action: result.suggestedAction,
      checked_at: checkedAt,
    });
  } catch (err) {
    next(err);
  }
});

/** Map a request type onto the Check model's inputType enum. */
function inputTypeFor(type) {
  switch (type) {
    case "momo_number":
    case "bank_account":
      return "number";
    case "domain":
      return "domain";
    case "url":
    case "telegram_link":
      return "url";
    case "wallet":
      return "wallet";
    default:
      return "name";
  }
}

export default router;
