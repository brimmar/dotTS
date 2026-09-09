import { Context, Effect, Layer } from 'effect';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface SecretStore {
  readonly encrypt: (value: string, key: string) => Effect.Effect<string, Error>;
  readonly decrypt: (encryptedValue: string, key: string) => Effect.Effect<string, Error>;
}

export const SecretStore = Context.GenericTag<SecretStore>('SecretStore');

/** Old AES key: first 32 ASCII chars of the hex master key, zero-padded. Delete after migration. */
export function legacyKeyMaterial(hex: string): Buffer {
  const padded = hex.length >= 32 ? hex : hex + '0'.repeat(32 - hex.length);
  return Buffer.from(padded.slice(0, 32), 'utf8');
}

function keyMaterial(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

function parseBlob(encryptedValue: string) {
  const [ivHex, authTagHex, encryptedHex] = encryptedValue.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid encrypted format');
  }
  return {
    iv: Buffer.from(ivHex, 'hex'),
    authTag: Buffer.from(authTagHex, 'hex'),
    encryptedHex,
  };
}

function encryptWithKey(value: string, key: Buffer): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptWithKey(encryptedValue: string, key: Buffer): string {
  const { iv, authTag, encryptedHex } = parseBlob(encryptedValue);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
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
  })
);
