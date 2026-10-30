import "dotenv/config";

import { existsSync, rmSync } from "node:fs";

const AUTH_DIR = process.env.AUTH_DIR || "./auth";

if (existsSync(AUTH_DIR)) {
  rmSync(AUTH_DIR, { recursive: true, force: true });
  console.log(`[logout] removed ${AUTH_DIR} -- you will scan a new QR code on next start.`);
} else {
  console.log(`[logout] nothing to remove, ${AUTH_DIR} does not exist.`);
}
