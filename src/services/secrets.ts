import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { Context, Effect, Layer } from "effect";

export interface SecretStore {
  readonly encrypt: (
    value: string,
    key: string,
  ) => Effect.Effect<string, Error>;
  readonly decrypt: (
    encryptedValue: string,
    key: string,
  ) => Effect.Effect<string, Error>;
}

export const SecretStore = Context.GenericTag<SecretStore>("SecretStore");

/** Old AES key: first 32 ASCII chars of the hex master key, zero-padded. Delete after migration. */
export function legacyKeyMaterial(hex: string): Buffer {
  const padded = hex.length >= 32 ? hex : hex + "0".repeat(32 - hex.length);
  return Buffer.from(padded.slice(0, 32), "utf8");
}

function keyMaterial(key: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return Buffer.from(key, "hex");
  }
  return createHash("sha256").update(key, "utf8").digest();
}

export const VAULT_HEADER = "$DOTTS_VAULT;1.0;AES-256-GCM";

export function formatVault(blob: string): string {
  const lines = [VAULT_HEADER];
  for (let i = 0; i < blob.length; i += 80) {
    lines.push(blob.slice(i, i + 80));
  }
  return `${lines.join("\n")}\n`;
}

export function parseVault(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith(VAULT_HEADER)) {
    const lines = trimmed.split(/\r?\n/).slice(1);
    return lines.map((l) => l.trim()).join("");
  }
  return trimmed;
}

export function isVaultFormat(content: string): boolean {
  return content.trim().startsWith(VAULT_HEADER);
}

function parseBlob(encryptedValue: string) {
  const parts = encryptedValue.split(":");
  if (parts.length < 3) {
    throw new Error("Invalid encrypted format");
  }
  const [ivHex, authTagHex, encryptedHex] = parts;
  if (!ivHex || !authTagHex || encryptedHex === undefined) {
    throw new Error("Invalid encrypted format");
  }
  return {
    iv: Buffer.from(ivHex, "hex"),
    authTag: Buffer.from(authTagHex, "hex"),
    encryptedHex,
  };
}

function encryptWithKey(value: string, key: Buffer): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decryptWithKey(encryptedValue: string, key: Buffer): string {
  const { iv, authTag, encryptedHex } = parseBlob(encryptedValue);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/** Decrypt using only the 32-byte hex-decoded key. No legacy fallback. */
export function decryptNew(encryptedValue: string, hex: string): string {
  return decryptWithKey(encryptedValue, keyMaterial(hex));
}

export const SecretStoreLive = Layer.succeed(
  SecretStore,
  SecretStore.of({
    encrypt: (value, key) =>
      Effect.try({
        try: () => encryptWithKey(value, keyMaterial(key)),
        catch: (error) => new Error(`Encryption failed: ${String(error)}`),
      }),
    decrypt: (encryptedValue, key) =>
      Effect.try({
        try: () => {
          try {
            return decryptNew(encryptedValue, key);
          } catch {
            return decryptWithKey(encryptedValue, legacyKeyMaterial(key));
          }
        },
        catch: (error) => new Error(`Decryption failed: ${String(error)}`),
      }),
  }),
);
