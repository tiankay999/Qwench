/**
 * Startup gate for the secrets the data model depends on.
 *
 * Both of these key one-way hashes of personal data (phone numbers, MoMo and
 * bank accounts). A default value would silently make every hash in every
 * deployment identical and therefore reversible by anyone with the code, so
 * there is deliberately no fallback: the app refuses to start without them.
 */

const REQUIRED = [
  {
    name: "PHONE_HASH_SALT",
    purpose: "hashing phone, MoMo and bank numbers so raw values are never stored",
  },
  {
    name: "HMAC_SECRET_KEY",
    purpose: "keyed hashing of identifiers shared between member organisations",
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
  console.error("     These key one-way hashes of personal data. Changing them later");
  console.error("     invalidates every existing hash, so set them once and keep them.");
  console.error("");

  if (exitOnFailure) process.exit(1);
  return { ok: false, missing, weak };
}

export function secretsPresent() {
  return REQUIRED.every(({ name }) => (process.env[name] || "").trim().length >= MIN_LENGTH);
}
