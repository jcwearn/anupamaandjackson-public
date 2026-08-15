/**
 * WebCrypto helpers shared between the Node generator and the browser.
 *
 * Node 19+ exposes the same global `crypto.subtle` the browser does, so both
 * sides run this identical code — the generator encrypts with it, the client
 * decrypts with it, and the key derivation can't drift between them.
 *
 * Threat model: this protects against a guest casually reading the index and
 * discovering names, event details, or who was invited to what. It is NOT
 * meant to withstand a determined attacker — the guest list is small and names
 * are guessable, so anyone willing to run a dictionary will get in. The KDF
 * raises the cost of doing that in bulk, nothing more.
 */

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const KDF_ITERATIONS = 150000
export const SALT_BYTES = 16
export const IV_BYTES = 12
/** Truncated SHA-256; ample to keep 621 guests collision-free. */
export const LOOKUP_HASH_BYTES = 12

export function bytesToBase64(bytes) {
  let binary = ''
  // Chunked to avoid blowing the argument limit on large inputs.
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export function base64ToBytes(value) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function toBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

/**
 * The index key a normalized name is stored under. Salted so the same guest
 * list rebuilt tomorrow produces different keys, which stops anyone diffing
 * two published indexes to spot who was added or removed.
 */
export async function lookupHash(normalizedKey, salt) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    concatBytes(salt, encoder.encode(normalizedKey)),
  )
  return toBase64Url(new Uint8Array(digest).subarray(0, LOOKUP_HASH_BYTES))
}

/**
 * Verifier for the email a guest offers when their name is ambiguous. Salted
 * like `lookupHash` so rebuilt indexes aren't diffable; the 'email:' prefix is
 * domain separation from the name hashes sharing the salt.
 */
export async function emailHash(normalizedEmail, salt) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    concatBytes(salt, encoder.encode(`email:${normalizedEmail}`)),
  )
  return toBase64Url(new Uint8Array(digest).subarray(0, LOOKUP_HASH_BYTES))
}

/** Stretches a normalized name into the AES key protecting that guest's record. */
export async function deriveGuestKey(normalizedKey, salt, iterations = KDF_ITERATIONS) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(normalizedKey),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Imports a raw per-event key carried inside a decrypted guest record. */
export async function importEventKey(rawBytes) {
  return crypto.subtle.importKey('raw', rawBytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

export async function encryptJson(key, value) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(value)),
  )
  return { iv: bytesToBase64(iv), ct: bytesToBase64(new Uint8Array(ciphertext)) }
}

/** Returns null when the key is wrong, rather than throwing an opaque error. */
export async function decryptJson(key, envelope) {
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) },
      key,
      base64ToBytes(envelope.ct),
    )
    return JSON.parse(decoder.decode(plaintext))
  } catch {
    return null
  }
}
