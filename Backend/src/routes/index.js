import { Router } from "express";

import { publicLimiter } from "../middleware/rateLimiter.js";
import institutionalRoutes from "./institutional.js";
import publicRoutes from "./public.js";

/**
 * The /v1 API.
 *
 *   /v1/public/*  no auth, 30 req/min per IP
 *   /v1/*         API key required, per-key rate limit
 *
 * The public router is mounted first so /v1/public/check is not caught by the
 * institutional key check.
 */
const router = Router();

router.use("/public", publicLimiter, publicRoutes);
router.use("/", institutionalRoutes);

export default router;
