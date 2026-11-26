import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Szyfrowanie sekretów (klucze API, tokeny OAuth) algorytmem AES-256-GCM.
 *
 * Klucze główne pochodzą ze zmiennej APP_ENCRYPTION_KEYS ("1:base64,2:base64"), aktywny klucz
 * wskazuje APP_ENCRYPTION_ACTIVE_KEY. Każdy zaszyfrowany rekord zapamiętuje wersję klucza,
 * więc po dodaniu nowego klucza stare dane nadal da się odczytać, a przy zapisie są
 * szyfrowane już nowym (rotacja kluczy bez przestojów).
 *
 * Format: "v1.<wersjaKlucza>.<iv>.<tag>.<szyfrogram>" (base64url).
 */

export interface Keyring {
  activeVersion: number;
  keys: Map<number, Buffer>;
}

export function parseKeyring(keysEnv: string | undefined, activeEnv: string | undefined): Keyring {
  if (!keysEnv) throw new Error("Brak zmiennej APP_ENCRYPTION_KEYS");
  const keys = new Map<number, Buffer>();
  for (const part of keysEnv.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [v, b64] = part.split(":");
    const version = Number(v);
    if (!Number.isInteger(version) || version < 1 || !b64) {
      throw new Error("Nieprawidłowy format APP_ENCRYPTION_KEYS (oczekiwano wersja:klucz_base64)");
    }
    const key = Buffer.from(b64, "base64");
    if (key.length !== 32) throw new Error(`Klucz w wersji ${version} musi mieć 32 bajty (ma ${key.length})`);
    keys.set(version, key);
  }
  const activeVersion = Number(activeEnv ?? Math.max(...keys.keys()));
  if (!keys.has(activeVersion)) throw new Error(`Aktywny klucz w wersji ${activeVersion} nie istnieje`);
  return { activeVersion, keys };
}

let cached: Keyring | undefined;
export function getKeyring(): Keyring {
  cached ??= parseKeyring(process.env.APP_ENCRYPTION_KEYS, process.env.APP_ENCRYPTION_ACTIVE_KEY);
  return cached;
}

export interface EncryptedValue {
  ciphertext: string;
  keyVersion: number;
}

export function encryptSecret(plain: string, keyring: Keyring = getKeyring(), aad = ""): EncryptedValue {
  const key = keyring.keys.get(keyring.activeVersion)!;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ciphertext = ["v1", keyring.activeVersion, iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(".");
  return { ciphertext, keyVersion: keyring.activeVersion };
}

export function decryptSecret(ciphertext: string, keyring: Keyring = getKeyring(), aad = ""): string {
  const [format, v, ivB64, tagB64, dataB64] = ciphertext.split(".");
  if (format !== "v1" || !v || !ivB64 || !tagB64 || dataB64 === undefined) {
    throw new Error("Nieznany format zaszyfrowanej wartości");
  }
  const key = keyring.keys.get(Number(v));
  if (!key) throw new Error(`Brak klucza w wersji ${v} – nie można odszyfrować`);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
}

/** Pomocniki dla obiektów JSON (np. { clientId, clientSecret }). */
export function encryptJson(value: unknown, keyring?: Keyring, aad?: string): EncryptedValue {
  return encryptSecret(JSON.stringify(value), keyring, aad);
}

export function decryptJson<T = unknown>(ciphertext: string, keyring?: Keyring, aad?: string): T {
  return JSON.parse(decryptSecret(ciphertext, keyring, aad)) as T;
}

/** Maskuje sekret do wyświetlenia w UI, np. "sk_live_abcd1234" → "••••1234". */
export function maskSecret(value: string): string {
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}
