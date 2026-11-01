/**
 * Global error handler.
 *
 * Logs the path and method only. Never the body, query string or headers --
 * those carry the phone numbers and message text the whole data model exists
 * to keep out of storage, and a log file is storage.
 */
export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} -> ${status}: ${err.message}`);
  if (status >= 500 && err.stack) console.error(err.stack.split("\n").slice(1, 4).join("\n"));

  // A 500 must not leak internals (collection names, key errors) to a caller.
  const message = status >= 500 ? "Internal server error" : err.message || "Request failed";

  res.status(status).json({ error: message, code: status });
}

/** 404 in the same shape as every other error. */
export function notFound(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}`, code: 404 });
}
