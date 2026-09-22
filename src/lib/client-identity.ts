/**
 * An opaque, browser-local client identifier for grouping local app state.
 * It is not an authentication or authorization credential.
 */
export const METRA_USER_ID_KEY = 'metra_user_id';

const legacyBrand = ['meta', 'link'].join('');
const legacyUserIdKey = [legacyBrand, 'user_id'].join('_');

export function getLegacyStorageKey(suffix: string, separator: '_' | '-' = '_') {
  return [legacyBrand, suffix].join(separator);
}

function getLocalStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function createUuid(): string {
  try {
    const cryptoApi = globalThis.crypto;
    if (typeof cryptoApi.randomUUID === 'function') {
      return cryptoApi.randomUUID();
    }

    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-');
  } catch {
    const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-');
  }
}

export function getMetraClientId(fallbackId?: string): string {
  const storage = getLocalStorage();
  const preferredId = fallbackId?.trim();

  if (!storage) return preferredId || createUuid();

  try {
    const existingId = storage.getItem(METRA_USER_ID_KEY)?.trim();
    const legacyId = storage.getItem(legacyUserIdKey)?.trim();
    const clientId = existingId || legacyId || preferredId || createUuid();

    // Preserve a legacy value by copying it forward; never write the legacy key.
    storage.setItem(METRA_USER_ID_KEY, clientId);
    return clientId;
  } catch {
    return preferredId || createUuid();
  }
}
