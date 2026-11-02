import "dotenv/config";

import mongoose from "mongoose";

import { collect, collectorStatus } from "../collectors/run.js";
import { connectDB } from "../config/db.js";
import { requireSecrets } from "../config/env.js";

/**
 * Collects new regulator notices once. Everything lands as pending, for a person to
 * approve in the console's review queue.
 *
 *   node src/scripts/collect.js
 *   node src/scripts/collect.js bog
 */
requireSecrets();
await connectDB();

const ids = process.argv.slice(2);
const report = await collect(ids.length ? ids : undefined);
console.log(JSON.stringify(report, null, 2));
console.log(JSON.stringify(await collectorStatus(), null, 2));

await mongoose.disconnect();
process.exit(0);
