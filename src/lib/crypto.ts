// Zero-Trust Cryptographic Operations
// All crypto happens client-side - server never sees plaintext

// Generate RSA key pair for asymmetric encryption
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// Generate RSA key pair for signing
export async function generateSigningKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    {
      name: 'RSA-PSS',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );
}

// Export public key to base64
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('spki', key);
  return arrayBufferToBase64(exported);
}

// Export private key to base64
export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('pkcs8', key);
  return arrayBufferToBase64(exported);
}

// Import public key from base64
export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    'spki',
    keyData,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );
}

// Import private key from base64
export async function importPrivateKey(base64Key: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    'pkcs8',
    keyData,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  );
}

// Import signing public key from base64
export async function importSigningPublicKey(base64Key: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    'spki',
    keyData,
    {
      name: 'RSA-PSS',
      hash: 'SHA-256',
    },
    true,
    ['verify']
  );
}

// Import signing private key from base64
export async function importSigningPrivateKey(base64Key: string): Promise<CryptoKey> {
  const keyData = base64ToArrayBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    'pkcs8',
    keyData,
    {
      name: 'RSA-PSS',
      hash: 'SHA-256',
    },
    true,
    ['sign']
  );
}

// Generate random AES-256-GCM key
export async function generateAESKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// Generate random nonce (IV) for AES-GCM
export function generateNonce(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(12));
}

// Encrypt file using AES-256-GCM
export async function encryptFile(
  file: ArrayBuffer,
  aesKey: CryptoKey,
  nonce: Uint8Array
): Promise<ArrayBuffer> {
  return await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce as Uint8Array<ArrayBuffer>,
    },
    aesKey,
    file
  );
}

// Decrypt file using AES-256-GCM
export async function decryptFile(
  encryptedData: ArrayBuffer,
  aesKey: CryptoKey,
  nonce: Uint8Array
): Promise<ArrayBuffer> {
  return await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: nonce as Uint8Array<ArrayBuffer>,
    },
    aesKey,
    encryptedData
  );
}

// Encrypt AES key using receiver's RSA public key
export async function encryptAESKey(
  aesKey: CryptoKey,
  receiverPublicKey: CryptoKey
): Promise<ArrayBuffer> {
  const rawKey = await window.crypto.subtle.exportKey('raw', aesKey);
  return await window.crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    receiverPublicKey,
    rawKey
  );
}

// Decrypt AES key using receiver's RSA private key
export async function decryptAESKey(
  encryptedAESKey: ArrayBuffer,
  privateKey: CryptoKey
): Promise<CryptoKey> {
  const rawKey = await window.crypto.subtle.decrypt(
    {
      name: 'RSA-OAEP',
    },
    privateKey,
    encryptedAESKey
  );
  return await window.crypto.subtle.importKey(
    'raw',
    rawKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['decrypt']
  );
}

// Sign data using sender's private key
export async function signData(
  data: ArrayBuffer,
  privateKey: CryptoKey
): Promise<ArrayBuffer> {
  return await window.crypto.subtle.sign(
    {
      name: 'RSA-PSS',
      saltLength: 32,
    },
    privateKey,
    data
  );
}

// Verify signature using sender's public key
export async function verifySignature(
  signature: ArrayBuffer,
  data: ArrayBuffer,
  publicKey: CryptoKey
): Promise<boolean> {
  return await window.crypto.subtle.verify(
    {
      name: 'RSA-PSS',
      saltLength: 32,
    },
    publicKey,
    signature,
    data
  );
}

// Hash data for signing
export async function hashData(data: ArrayBuffer): Promise<ArrayBuffer> {
  return await window.crypto.subtle.digest('SHA-256', data);
}

// Utility: ArrayBuffer to Base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Utility: Base64 to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Utility: Concatenate ArrayBuffers for hashing
export function concatenateBuffers(...buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buffer of buffers) {
    result.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }
  return result.buffer;
}
