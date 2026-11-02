/**
 * Startup gate for the secrets the app depends on.
 *
 * The first two key one-way hashes of personal data (phone numbers, MoMo and
 * bank accounts); JWT_SECRET signs console sessions. A default value would make
 * every hash reversible, and every session forgeable, by anyone with the code,
 * so there is deliberately no fallback: the app refuses to start without them.
 */

const REQUIRED = [
  {
    name: "PHONE_HASH_SALT",
    purpose: "hashing senders for the daily fair-use limit, and reporter numbers on /api",
  },
  {
    name: "HMAC_SECRET_KEY",
    purpose: "keyed hashing of every identifier, including MoMo and bank numbers",
  },
  {
    name: "JWT_SECRET",
    purpose: "signing console login sessions",
  },
];

const MIN_LENGTH = 16;

export function requireSecrets({ exitOnFailure = true } = {}) {
  const missing = [];
  const weak = [];

  for (const { name, purpose } of REQUIRED) {
    const value = (process.env[name] || "").trim();
    if (!value) missing.push({ name, purpose });
    else if (value.length < MIN_LENGTH) weak.push({ name, length: value.length });
  }

  if (!missing.length && !weak.length) return { ok: true };

  console.error("");
  console.error("  ❌ Qwench cannot start — required secrets are missing or too weak.");
  console.error("");

  for (const { name, purpose } of missing) {
    console.error(`     ${name} is not set`);
    console.error(`       used for: ${purpose}`);
  }
  for (const { name, length } of weak) {
    console.error(`     ${name} is only ${length} characters (minimum ${MIN_LENGTH})`);
  }

  console.error("");
  console.error("     Generate strong values and put them in Backend/.env:");
  console.error("       node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  console.error("");
  console.error("     PHONE_HASH_SALT and HMAC_SECRET_KEY key one-way hashes of personal data.");
  console.error("     Changing them later invalidates every existing hash, so set them once and keep them.");
  console.error("");

  if (exitOnFailure) process.exit(1);
  return { ok: false, missing, weak };
}

export function secretsPresent() {
  return REQUIRED.every(({ name }) => (process.env[name] || "").trim().length >= MIN_LENGTH);
}
