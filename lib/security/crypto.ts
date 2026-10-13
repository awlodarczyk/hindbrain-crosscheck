import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";

const SALT = "hindbrain-crosscheck";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

export type Encrypted = { ciphertext: string; iv: string; tag: string };

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}

/** Derives a 32-byte key from the app secret with HKDF-SHA256, scoped by purpose. */
export function deriveKey(appSecret: string, purpose: "secrets" | "cookie"): Buffer {
  return Buffer.from(hkdfSync("sha256", appSecret, SALT, purpose, 32));
}

/** AES-256-GCM encryption with a random 12-byte IV; fields are base64. */
export function encrypt(key: Buffer, plaintext: string): Encrypted {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

/** @throws CryptoError("tamper") when authentication fails or the payload is malformed. */
export function decrypt(key: Buffer, enc: Encrypted): string {
  try {
    const decipher = createDecipheriv(ALGO, key, Buffer.from(enc.iv, "base64"));
    decipher.setAuthTag(Buffer.from(enc.tag, "base64"));
    const out = Buffer.concat([
      decipher.update(Buffer.from(enc.ciphertext, "base64")),
      decipher.final(),
    ]);
    return out.toString("utf8");
  } catch {
    throw new CryptoError("tamper");
  }
}

/** Shows the first 7 and last 4 characters of long secrets; short ones are fully hidden. */
export function mask(secret: string): string {
  return secret.length >= 12 ? `${secret.slice(0, 7)}••••${secret.slice(-4)}` : "••••";
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Random base64url token of `bytes` random bytes. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
