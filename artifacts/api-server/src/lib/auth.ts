import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";

const JWT_SECRET = process.env.SESSION_SECRET ?? "pesamatrix-secret-key";
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(userId: number, role: string): string {
  return jwt.sign({ sub: userId, role }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): { sub: number; role: string } {
  const payload = jwt.verify(token, JWT_SECRET) as unknown as { sub: number; role: string };
  return payload;
}

function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET ?? "pesamatrix-secret-key";
  return createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a credential using AES-256-GCM.
 * Output format: "v2:<base64(iv[12] || authTag[16] || ciphertext)>"
 */
export function encryptCredential(plain: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, tag, ciphertext]);
  return `v2:${combined.toString("base64")}`;
}

/**
 * Decrypts a credential.
 * Supports v2 (AES-256-GCM) and legacy v1 (plain base64) formats for
 * backward-compatibility with records encrypted before the AES upgrade.
 */
export function decryptCredential(encoded: string): string {
  if (encoded.startsWith("v2:")) {
    const key = getEncryptionKey();
    const buf = Buffer.from(encoded.slice(3), "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  }
  return Buffer.from(encoded, "base64").toString("utf8");
}
