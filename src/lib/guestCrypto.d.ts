export declare const KDF_ITERATIONS: number
export declare const SALT_BYTES: number
export declare const IV_BYTES: number
export declare const LOOKUP_HASH_BYTES: number

export interface Envelope {
  iv: string
  ct: string
}

export declare function bytesToBase64(bytes: Uint8Array): string
export declare function base64ToBytes(value: string): Uint8Array
export declare function lookupHash(normalizedKey: string, salt: Uint8Array): Promise<string>
export declare function emailHash(normalizedEmail: string, salt: Uint8Array): Promise<string>
export declare function deriveGuestKey(
  normalizedKey: string,
  salt: Uint8Array,
  iterations?: number,
): Promise<CryptoKey>
export declare function importEventKey(rawBytes: Uint8Array): Promise<CryptoKey>
export declare function encryptJson(key: CryptoKey, value: unknown): Promise<Envelope>
export declare function decryptJson<T = unknown>(
  key: CryptoKey,
  envelope: Envelope,
): Promise<T | null>
