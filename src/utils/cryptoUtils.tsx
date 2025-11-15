import CryptoJS from "crypto-js";

const SECRET_KEY = "MIIEpAIBAAKCAQEA7BnXPVlYgurhY0tULm8SgnO4vZrwi4ynJ2Swoen1vlfJttkueyyOVR60qE/f2Znl23ohN/stDdP95uFhZF1LIc0FzSgdbzS5ZeIJrFJDJtHcMWobXAY7VpHB5Re02UU9xCBWNklHRJU/y3gfNVK7DxLBovz36m6RStEg2bm9+a31HAyvT2fdq3mj7slsBVFvftvv91yxCPTnYKE0pnlukz+W2qgthELliYnHwm2RViMRG58qX5b5RORH92FcHvnltElqQQfD3TkkWIs7OKvbQRPKfdnrr3SUJyHJGcUIGpfRH1M7qsJKKmJJsy1OnH6A+va0NViX0HMRK0sD39AxpQIDAQABAoIBAAKwdqmtu1reZwvU";

export function encodeData<T>(data: T): string {
  const encrypted = CryptoJS.AES.encrypt(
    JSON.stringify(data),
    SECRET_KEY
  ).toString();

  return encodeURIComponent(encrypted);
}

export function decodeData<T>(hash: string): T | null {
  try {
    if (!hash) return null;

    const bytes = CryptoJS.AES.decrypt(
      decodeURIComponent(hash),
      SECRET_KEY
    );
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    if (!decrypted) return null;

    return JSON.parse(decrypted) as T;
  } catch (error) {
    console.error("Failed to decode data:", error);
    return null;
  }
}
