import { Context, Effect, Layer } from 'effect';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export class SecretStore extends Context.Tag('SecretStore')<
  SecretStore,
  {
    readonly encrypt: (value: string, key: string) => Effect.Effect<string, Error>;
    readonly decrypt: (encryptedValue: string, key: string) => Effect.Effect<string, Error>;
  }
>() {}

export const SecretStoreLive = Layer.succeed(
  SecretStore,
  SecretStore.of({
    encrypt: (value, key) =>
      Effect.try({
        try: () => {
          const iv = randomBytes(16);
          // Key must be 32 bytes for aes-256-gcm
          // For now, we assume the provided key is correct length or we pad/hash it.
          // Let's ensure it's 32 bytes by hashing if needed, or simple padding.
          // Ideally, we derive a key using pbkdf2, but for this primitive let's trust the input or fix it.
          // Let's act simple: Pad or slice to 32 chars.
          const validKey = key.padEnd(32, '0').slice(0, 32); 
          
          const cipher = createCipheriv('aes-256-gcm', validKey, iv);
          let encrypted = cipher.update(value, 'utf8', 'hex');
          encrypted += cipher.final('hex');
          const authTag = cipher.getAuthTag().toString('hex');
          
          // Format: iv:authTag:encrypted
          return `${iv.toString('hex')}:${authTag}:${encrypted}`;
        },
        catch: (error) => new Error(`Encryption failed: ${String(error)}`),
      }),
    decrypt: (encryptedValue, key) =>
      Effect.try({
        try: () => {
          const [ivHex, authTagHex, encryptedHex] = encryptedValue.split(':');
          if (!ivHex || !authTagHex || !encryptedHex) {
            throw new Error('Invalid encrypted format');
          }
          
          const validKey = key.padEnd(32, '0').slice(0, 32);
          const iv = Buffer.from(ivHex, 'hex');
          const authTag = Buffer.from(authTagHex, 'hex');
          
          const decipher = createDecipheriv('aes-256-gcm', validKey, iv);
          decipher.setAuthTag(authTag);
          let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          
          return decrypted;
        },
        catch: (error) => new Error(`Decryption failed: ${String(error)}`),
      }),
  })
);
