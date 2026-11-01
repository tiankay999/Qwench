/**
 * Error handling.
 *
 * /v1 errors always use { "error": { "code": "...", "message": "..." } } with a
 * status of 400, 401, 403, 404, 429 or 500. Everything else (/api, /health) keeps
 * its existing shape until /api is retired.
 *
 * Logs carry the method, path and error type only. Never the body, query string,
 * headers or error message: those can carry the phone numbers and message text
 * the data model exists to keep out of storage, and a log file is storage.
 */

const V1_STATUSES = new Set([400, 401, 403, 404, 429, 500]);

const DEFAULT_CODES = {
  400: "invalid_input",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  429: "rate_limited",
  500: "internal_error",
};

// Body-parser messages quote the rejected input, so they are never passed on.
const BODY_ERRORS = {
  "entity.parse.failed": { code: "invalid_json", message: "Request body must be valid JSON" },
  "entity.too.large": { code: "body_too_large", message: "Request body is too large" },
};

/** Send a /v1 error. */
export function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function isV1(req) {
  return req.originalUrl === "/v1" || req.originalUrl.startsWith("/v1/") || req.originalUrl.startsWith("/v1?");
}

function v1Status(status) {
  if (V1_STATUSES.has(status)) return status;
  return status >= 400 && status < 500 ? 400 : 500;
}

export function errorHandler(err, req, res, _next) {
  const rawStatus = err.status || err.statusCode || 500;

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} -> ${rawStatus}: ${err.name}${err.type ? ` (${err.type})` : ""}`);
  if (rawStatus >= 500 && err.stack) console.error(err.stack.split("\n").slice(1, 4).join("\n"));

  if (!isV1(req)) {
    // A 500 must not leak internals (collection names, key errors) to a caller.
    const message = rawStatus >= 500 ? "Internal server error" : err.message || "Request failed";
    return res.status(rawStatus).json({ error: message, code: rawStatus });
  }

  const status = v1Status(rawStatus);
  if (status === 500) return sendError(res, 500, DEFAULT_CODES[500], "Internal server error");

  const known = BODY_ERRORS[err.type];
  if (known) return sendError(res, status, known.code, known.message);

  return sendError(res, status, err.code && typeof err.code === "string" ? err.code : DEFAULT_CODES[status], err.expose ? err.message : "Request failed");
}

/** 404 in the same shape as every other error on that path. */
export function notFound(req, res) {
  if (isV1(req)) return sendError(res, 404, "not_found", `No route for ${req.method} ${req.path}`);
  return res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}`, code: 404 });
}
