import { Context, Effect, Layer } from 'effect';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface SecretStore {
  readonly encrypt: (value: string, key: string) => Effect.Effect<string, Error>;
  readonly decrypt: (encryptedValue: string, key: string) => Effect.Effect<string, Error>;
}

export const SecretStore = Context.GenericTag<SecretStore>('SecretStore');

export const SecretStoreLive = Layer.succeed(
  SecretStore,
  SecretStore.of({
    encrypt: (value, key) =>
      Effect.try({
        try: () => {
          const iv = randomBytes(16);
          const validKey = key.padEnd(32, '0').slice(0, 32); 
          
          const cipher = createCipheriv('aes-256-gcm', validKey, iv);
          let encrypted = cipher.update(value, 'utf8', 'hex');
          encrypted += cipher.final('hex');
          const authTag = cipher.getAuthTag().toString('hex');
          
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