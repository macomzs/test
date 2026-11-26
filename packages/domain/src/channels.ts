/**
 * Pola poświadczeń wymagane przez poszczególne konektory.
 * Wartości są szyfrowane w bazie i nigdy nie są wyświetlane w całości.
 * (Etap 7+ – przy realnych integracjach pola zostaną zweryfikowane z dokumentacją API.)
 */
export interface CredentialField {
  key: string;
  label: string;
  secret: boolean;
  hint?: string;
}

export const CONNECTOR_CREDENTIAL_FIELDS: Record<string, CredentialField[]> = {
  allegro: [
    { key: "clientId", label: "Client ID", secret: false, hint: "Z aplikacji zarejestrowanej w Allegro Developer Portal." },
    { key: "clientSecret", label: "Client Secret", secret: true },
  ],
  kaufland: [
    { key: "clientKey", label: "Client Key", secret: false },
    { key: "secretKey", label: "Secret Key", secret: true },
  ],
  mirakl: [{ key: "apiKey", label: "Klucz API sklepu", secret: true }],
  erli: [{ key: "apiKey", label: "Klucz API", secret: true }],
  obi: [{ key: "apiKey", label: "Klucz API", secret: true }],
};

export function credentialFieldsFor(connectorKey: string): CredentialField[] {
  return CONNECTOR_CREDENTIAL_FIELDS[connectorKey] ?? [{ key: "apiKey", label: "Klucz API", secret: true }];
}
