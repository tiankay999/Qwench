import { body, query, validationResult } from "express-validator";

import { IDENTIFIER_TYPES } from "../lib/identifiers.js";
import { sendError } from "./errorHandler.js";

/**
 * Input validation for every endpoint.
 *
 * Every rule set ends with `stripUnknown`, which deletes anything not
 * explicitly allowed. That is what stops a caller smuggling an extra field
 * into a Mongoose write, and what keeps raw message text out of the system
 * when a bot sends more than it should.
 */

/** Collect express-validator errors into the /v1 error shape. */
export function handleValidation(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const first = result.array()[0];
  return sendError(res, 400, "invalid_input", `Invalid input: ${first.msg}`);
}

/** Drop any field the endpoint did not declare. */
export function stripUnknown(allowed) {
  return function strip(req, _res, next) {
    if (req.body && typeof req.body === "object") {
      for (const key of Object.keys(req.body)) {
        if (!allowed.includes(key)) delete req.body[key];
      }
    }
    next();
  };
}

/* ------------------------------------------------------------------ *
 * Rule sets
 * ------------------------------------------------------------------ */

// The contract's public-check types. "url" is accepted and treated as a domain.
export const CHECK_TYPES = [...IDENTIFIER_TYPES, "url"];

export const checkRules = [
  stripUnknown(["recipient", "type", "amount_ghs", "new_payee"]),
  body("recipient").exists({ checkFalsy: true }).withMessage("recipient is required").bail().isString().isLength({ max: 500 }),
  body("type")
    .exists({ checkFalsy: true })
    .withMessage("type is required")
    .bail()
    .isIn(CHECK_TYPES)
    .withMessage(`type must be one of: ${CHECK_TYPES.join(", ")}`),
  body("amount_ghs").optional().isFloat({ min: 0, max: 100_000_000 }).withMessage("amount_ghs must be a positive number"),
  body("new_payee").optional().isBoolean().withMessage("new_payee must be a boolean"),
  handleValidation,
];

export const contributionRules = [
  stripUnknown(["schemeName", "identifiers", "terms", "region", "lossBand", "evidenceRefs"]),
  body("schemeName").exists({ checkFalsy: true }).withMessage("schemeName is required").bail().isString().isLength({ max: 300 }),
  body("identifiers").optional().isArray({ max: 50 }).withMessage("identifiers must be an array"),
  body("identifiers.*.type").optional().isIn(IDENTIFIER_TYPES).withMessage("unknown identifier type"),
  body("identifiers.*.value").optional().isString().isLength({ max: 500 }),
  body("terms").optional().isString().isLength({ max: 500 }),
  body("region").optional().isString().isLength({ max: 120 }),
  body("lossBand").optional().isString().isLength({ max: 60 }),
  body("evidenceRefs").optional().isArray({ max: 50 }),
  handleValidation,
];

export const feedRules = [
  query("since").exists({ checkFalsy: true }).withMessage("since parameter required").bail().isISO8601().withMessage("since must be an ISO 8601 date"),
  query("format").optional().isIn(["json", "csv"]).withMessage("format must be json or csv"),
  query("limit").optional().isInt({ min: 1, max: 1000 }).withMessage("limit must be between 1 and 1000"),
  handleValidation,
];

export const merchantNumberRules = [
  stripUnknown(["number", "type"]),
  body("number").exists({ checkFalsy: true }).withMessage("number and type required").bail().isString().isLength({ max: 100 }),
  body("type")
    .exists({ checkFalsy: true })
    .withMessage("number and type required")
    .bail()
    .isIn(["momo_number", "bank_account"])
    .withMessage("type must be momo_number or bank_account"),
  handleValidation,
];
