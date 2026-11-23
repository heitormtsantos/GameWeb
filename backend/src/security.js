import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt),
  options = { N: 65536, r: 8, p: 2, maxmem: 96 * 1024 * 1024 };
let active = 0;
const waiting = [];
async function slot(fn) {
  if (active >= 2) {
    if (waiting.length >= 8) {
      const error = new Error("Tente novamente em instantes.");
      error.statusCode = 429;
      error.code = "AUTH_BUSY";
      throw error;
    }
    await new Promise((resolve) => waiting.push(resolve));
  } else active++;
  try {
    return await fn();
  } finally {
    if (waiting.length) waiting.shift()();
    else active--;
  }
}
export async function hashPassword(password) {
  return slot(async () => {
    const salt = randomBytes(24).toString("base64url"),
      key = await derive(password, salt, 32, options);
    return `scrypt$65536$8$2$${salt}$${key.toString("base64url")}`;
  });
}
export async function verifyPassword(password, encoded) {
  return slot(async () => {
    const [kind, n, r, p, salt, hash] = encoded.split("$");
    if (
      kind !== "scrypt" ||
      n !== "65536" ||
      r !== "8" ||
      p !== "2" ||
      !salt ||
      !hash
    )
      return false;
    const actual = await derive(password, salt, 32, options),
      expected = Buffer.from(hash, "base64url");
    return (
      expected.length === actual.length && timingSafeEqual(actual, expected)
    );
  });
}
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export function tokenFrom(request) {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(
    request.headers.authorization || "",
  );
  return match ? match[1] : null;
}
