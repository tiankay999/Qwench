import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const SECRETS = {
  PHONE_HASH_SALT: "test-only-phone-hash-salt",
  HMAC_SECRET_KEY: "test-only-hmac-secret-key",
  JWT_SECRET: "test-only-jwt-secret-value",
};

// An empty value also stops dotenv filling the variable in from a local .env.
function start(overrides) {
  return spawnSync(process.execPath, ["src/server.js"], {
    env: { ...process.env, ...SECRETS, MONGODB_URI: "", ...overrides },
    encoding: "utf8",
    timeout: 30000,
  });
}

for (const name of Object.keys(SECRETS)) {
  test(`refuses to start without ${name}`, () => {
    const run = start({ [name]: "" });
    assert.equal(run.status, 1);
    assert.match(run.stderr, new RegExp(`${name} is not set`));
  });

  test(`refuses to start with a weak ${name}`, () => {
    const run = start({ [name]: "short" });
    assert.equal(run.status, 1);
    assert.match(run.stderr, new RegExp(`${name} is only 5 characters`));
  });
}

test("gets past the secrets check when all three are set", () => {
  const run = start({});
  assert.equal(run.status, 1);
  assert.doesNotMatch(run.stderr, /required secrets/);
  assert.match(run.stderr, /MONGODB_URI environment variable is required/);
});
