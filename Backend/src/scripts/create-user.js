import "dotenv/config";

import crypto from "node:crypto";

import bcrypt from "bcrypt";
import mongoose from "mongoose";

import { connectDB } from "../config/db.js";
import { requireSecrets } from "../config/env.js";
import { ORG_TYPES, Organization, USER_ROLES, User } from "../models/index.js";

/**
 * Creates a console user. There is deliberately no sign-up route.
 *
 * The password comes from QWENCH_USER_PASSWORD, so it stays out of shell history.
 * Leave it unset and a strong one is generated and shown once.
 *
 *   node src/scripts/create-user.js --email a@b.gh --org "Qwench" --role reviewer
 *   node src/scripts/create-user.js --email a@b.gh --org "A Bank" --role org_admin --new-org bank
 */

const MIN_PASSWORD = 12;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const email = (arg("email") || "").trim().toLowerCase();
const orgName = (arg("org") || "").trim();
const role = arg("role");
const newOrgType = arg("new-org");

if (!email || !orgName || !role) fail('usage: node src/scripts/create-user.js --email a@b.gh --org "Name" --role reviewer [--new-org bank]');
if (!USER_ROLES.includes(role)) fail(`role must be one of: ${USER_ROLES.join(", ")}`);
if (newOrgType && !ORG_TYPES.includes(newOrgType)) fail(`--new-org must be one of: ${ORG_TYPES.join(", ")}`);

const given = process.env.QWENCH_USER_PASSWORD;
if (given !== undefined && given.length < MIN_PASSWORD) fail(`QWENCH_USER_PASSWORD must be at least ${MIN_PASSWORD} characters`);
const password = given || crypto.randomBytes(18).toString("base64url");

requireSecrets();
await connectDB();

let org = await Organization.findOne({ name: orgName });
if (!org) {
  if (!newOrgType) {
    await mongoose.disconnect();
    fail(`No organisation is called "${orgName}". Add --new-org with its type to create it.`);
  }
  org = await Organization.create({ name: orgName, type: newOrgType });
}

if (await User.exists({ email })) {
  await mongoose.disconnect();
  fail(`${email} already exists.`);
}

await User.create({ email, orgId: org._id, role, passwordHash: await bcrypt.hash(password, 12) });

console.log(`Created ${email}, ${role} at ${org.name}.`);
if (!given) console.log(`Password, shown once: ${password}`);

await mongoose.disconnect();
process.exit(0);
