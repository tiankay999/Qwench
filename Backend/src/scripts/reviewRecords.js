import "dotenv/config";

import mongoose from "mongoose";

import { connectDB } from "../config/db.js";
import { requireSecrets } from "../config/env.js";
import { Record, recordAudit } from "../models/index.js";

/**
 * Signs off records that are waiting on review, so they go active and the /v1
 * API can match against them.
 *
 * Why this exists: every record the migration imported was left `pending`
 * by design, and `/v1/check` only reads `status: "active"`. Without a review
 * step the API matches an entity but reports `no_record` for everything.
 *
 * This is a BULK sign-off. It satisfies the four-eyes rule mechanically --
 * the reviewer must differ from the capturer, and every activation is written
 * to the audit log -- but one person approving a whole register in a single
 * command is a governance shortcut, not a substitute for reading each notice.
 * For anything beyond bootstrapping an import, review records individually.
 *
 *   node src/scripts/reviewRecords.js --reviewer "ama@qwench.gh"
 *   node src/scripts/reviewRecords.js --reviewer "ama@qwench.gh" --dry-run
 */

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : null;
}

const DRY_RUN = process.argv.includes("--dry-run");
const reviewer = arg("reviewer");

async function main() {
  if (!reviewer) {
    console.error("");
    console.error("  A reviewer is required — four-eyes means a named second person.");
    console.error('  usage: node src/scripts/reviewRecords.js --reviewer "you@example.com"');
    console.error("");
    process.exit(1);
  }

  requireSecrets();
  await connectDB();

  const pending = await Record.find({ status: "pending" }).populate("entityId", "name").lean();
  console.log("");
  console.log(`  ${pending.length} record(s) awaiting review`);

  // The reviewer may not sign off their own captures.
  const ownCaptures = pending.filter((r) => (r.capturedBy || "").trim().toLowerCase() === reviewer.trim().toLowerCase());
  const reviewable = pending.filter((r) => !ownCaptures.includes(r));

  if (ownCaptures.length) {
    console.log(`  ${ownCaptures.length} captured by ${reviewer} — skipped, they need a different reviewer`);
  }

  if (DRY_RUN) {
    console.log(`  🔍 DRY RUN — would activate ${reviewable.length} record(s) as "${reviewer}"`);
    reviewable.slice(0, 5).forEach((r) => console.log(`     ${r.entityId?.name} (${r.type})`));
    if (reviewable.length > 5) console.log(`     ...and ${reviewable.length - 5} more`);
    console.log("");
    await mongoose.disconnect();
    process.exit(0);
  }

  let activated = 0;
  for (const r of reviewable) {
    // Go through the document so the four-eyes hook runs on each one.
    const doc = await Record.findById(r._id);
    if (!doc) continue;

    doc.reviewedBy = reviewer;
    doc.reviewedAt = new Date();
    doc.status = "active";

    try {
      await doc.save();
      activated += 1;
      await recordAudit({
        actor: reviewer,
        action: "record.review",
        target: `Record:${doc._id}`,
        before: { status: "pending" },
        after: { status: "active", reviewedBy: reviewer },
      });
    } catch (err) {
      console.warn(`  could not activate ${r.entityId?.name}: ${err.message}`);
    }
  }

  console.log(`  ✅ activated ${activated} record(s) as "${reviewer}"`);
  console.log(`     every activation written to the audit log`);
  console.log("");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("[review] failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
