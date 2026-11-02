import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import jwt from "jsonwebtoken";

import { Organization, User } from "../models/index.js";
import { sendError } from "./errorHandler.js";

/**
 * Console login sessions. The token sits in an httpOnly cookie, so page scripts
 * can't read it and no API key ever sits in the browser.
 */

const COOKIE = "qwench_session";
const SESSION_HOURS = 8;
const COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax", path: "/v1/console", secure: process.env.NODE_ENV === "production" };

export function startSession(res, user) {
  const token = jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: `${SESSION_HOURS}h` });
  res.cookie(COOKIE, token, { ...COOKIE_OPTIONS, maxAge: SESSION_HOURS * 3600 * 1000 });
}

export function endSession(res) {
  res.clearCookie(COOKIE, COOKIE_OPTIONS);
}

function tokenFrom(req) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return rest.join("=");
  }
  return null;
}

/** Checks the user every time, so a deactivated account stops working at once. */
export async function requireSession(req, res, next) {
  const refuse = () => sendError(res, 401, "session_required", "Please log in");

  const token = tokenFrom(req);
  if (!token) return refuse();

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return refuse();
  }

  try {
    const user = await User.findById(payload.sub).lean();
    if (!user || !user.isActive) return refuse();
    const org = await Organization.findById(user.orgId).lean();
    if (!org || org.status === "suspended") return refuse();

    req.user = user;
    req.organization = org;
    return next();
  } catch (err) {
    return next(err);
  }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : sendError(res, 403, "forbidden", "Your role can't do this");

/** The queue holds every organisation's submissions, so only Qwench's reviewers see it. */
export const requireQwenchReviewer = (req, res, next) =>
  req.user.role === "reviewer" && req.organization.type === "qwench" ? next() : sendError(res, 403, "forbidden", "Only Qwench's reviewers can do this");

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `login:${ipKeyGenerator(req.ip)}`,
  handler: (_req, res) => sendError(res, 429, "rate_limited", "Too many attempts. Try again in a minute."),
});

export const consoleLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `console:${req.user._id}`,
  handler: (_req, res) => sendError(res, 429, "rate_limited", "Too many requests. Try again in 60 seconds."),
});
