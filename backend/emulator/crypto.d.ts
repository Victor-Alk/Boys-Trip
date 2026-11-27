/** Types for backend/emulator/crypto.js (pure-JS SHA-256 / HMAC / base64 used by the emulator). */
export function sha256(bytes: Uint8Array): Uint8Array;
export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array;
export function utf8Encode(s: string): Uint8Array;
export function utf8Decode(bytes: Uint8Array): string;
export function toSignedArray(u8: Uint8Array): number[];
export function toBytes(data: string | Uint8Array | number[] | { getBytes(): number[] }): Uint8Array;
export function base64Encode(u8: Uint8Array): string;
export function base64Decode(s: string): Uint8Array;
export function base64EncodeWebSafe(u8: Uint8Array): string;
export function randomBytes(n: number): Uint8Array;
export function uuidV4(): string;
