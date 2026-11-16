const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function generateSaltBase64(length = 16): string {
  const salt = new Uint8Array(length);
  crypto.getRandomValues(salt);
  return bytesToBase64(salt);
}

function ensureWebCrypto(): SubtleCrypto {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error(
      'Criptografia local (Web Crypto) indisponível neste endereço. Acesse via HTTPS ou localhost.'
    );
  }
  return crypto.subtle;
}

export async function hashPin(pin: string, saltBase64: string): Promise<string> {
  const subtle = ensureWebCrypto();
  const keyMaterial = await subtle.importKey(
    'raw',
    TEXT_ENCODER.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const saltBytes = base64ToBytes(saltBase64);
  const bits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

export async function verifyPin(
  pin: string,
  expectedHash: string,
  saltBase64: string
): Promise<boolean> {
  const computed = await hashPin(pin, saltBase64);
  return computed === expectedHash;
}

async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = ensureWebCrypto();
  const keyMaterial = await subtle.importKey(
    'raw',
    TEXT_ENCODER.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 120000,
      hash: 'SHA-256',
    },
    keyMaterial,
    {name: 'AES-GCM', length: 256},
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedEnvelope {
  format: 'carbcontrol-backup';
  version: number;
  encrypted: true;
  algorithm: 'AES-GCM';
  salt: string;
  iv: string;
  ciphertext: string;
}

export async function encryptPayload(
  plaintext: string,
  password: string
): Promise<EncryptedEnvelope> {
  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(salt);
  crypto.getRandomValues(iv);

  const key = await deriveAesKey(password, salt);
  const encryptedBuffer = await crypto.subtle.encrypt(
    {name: 'AES-GCM', iv: iv.buffer as ArrayBuffer},
    key,
    TEXT_ENCODER.encode(plaintext)
  );

  return {
    format: 'carbcontrol-backup',
    version: 1,
    encrypted: true,
    algorithm: 'AES-GCM',
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
  };
}

export async function decryptPayload(
  envelope: EncryptedEnvelope,
  password: string
): Promise<string> {
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);

  const key = await deriveAesKey(password, salt);
  const decrypted = await crypto.subtle.decrypt(
    {name: 'AES-GCM', iv: iv.buffer as ArrayBuffer},
    key,
    ciphertext.buffer as ArrayBuffer
  );

  return TEXT_DECODER.decode(decrypted);
}
