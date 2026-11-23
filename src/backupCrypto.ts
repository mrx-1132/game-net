const KDF_ITERATIONS = 250000;
const FORMAT_ID = 'gamenet-encrypted-backup';

export interface EncryptedBackupEnvelope {
  format: typeof FORMAT_ID;
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  data: string;
}

const toBase64 = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
};

const fromBase64 = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const getSubtle = (): SubtleCrypto => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('crypto-unavailable');
  return subtle;
};

const deriveKey = async (password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> => {
  const subtle = getSubtle();
  const baseKey = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

export const isEncryptedBackup = (value: any): value is EncryptedBackupEnvelope =>
  !!value && typeof value === 'object' && value.format === FORMAT_ID && typeof value.data === 'string';

export const encryptBackup = async (payload: unknown, password: string): Promise<EncryptedBackupEnvelope> => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, KDF_ITERATIONS);
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = new Uint8Array(await getSubtle().encrypt({ name: 'AES-GCM', iv }, key, plain));
  return {
    format: FORMAT_ID,
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: KDF_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(cipher),
  };
};

export const decryptBackup = async (envelope: EncryptedBackupEnvelope, password: string): Promise<any> => {
  const key = await deriveKey(password, fromBase64(envelope.salt), envelope.iterations || KDF_ITERATIONS);
  const plain = await getSubtle().decrypt({ name: 'AES-GCM', iv: fromBase64(envelope.iv) }, key, fromBase64(envelope.data));
  return JSON.parse(new TextDecoder().decode(plain));
};
