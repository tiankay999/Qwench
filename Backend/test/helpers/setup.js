import os from "node:os";
import path from "node:path";

// Import this first in every test file. Secrets here exist only for tests, and
// every AI key is cleared so the suite proves checks work with no AI provider.
process.env.PHONE_HASH_SALT = "test-only-phone-hash-salt";
process.env.HMAC_SECRET_KEY = "test-only-hmac-secret-key";
process.env.JWT_SECRET = "test-only-jwt-secret-value";
process.env.AI_PROVIDER = "gemini";
for (const key of ["GEMINI_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY"]) delete process.env[key];

// The test MongoDB binary is large, so keep it out of the project and home folders.
process.env.MONGOMS_DOWNLOAD_DIR ||= path.join(os.tmpdir(), "qwench-mongo");

const { MongoMemoryServer } = await import("mongodb-memory-server");
const { default: mongoose } = await import("mongoose");

let mongo;

export async function startDb() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  // Build indexes now, so tests see the same constraints as a real database.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function stopDb() {
  await mongoose.disconnect();
  await mongo?.stop();
}

/** Serve an Express app on a free port. Returns its base URL and a close function. */
export async function serve(app) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export function post(url, body, headers = {}) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** Create an API key on a labelled demo organisation. Returns the raw key. */
export async function makeApiKey(scopes, extra = {}) {
  const { ApiKey, Organization, generateApiKey } = await import("../../src/models/index.js");
  const org = await Organization.create({
    name: `Fixture Org ${Math.random().toString(36).slice(2)}`,
    type: "bank",
    status: "demo",
  });
  const { rawKey, prefix, keyHash } = generateApiKey({ live: false });
  await ApiKey.create({ orgId: org._id, keyHash, prefix, scopes, ...extra });
  return rawKey;
}
