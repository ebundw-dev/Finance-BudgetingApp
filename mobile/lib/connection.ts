import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// Persists the API Base URL/token the user typed in so they don't have to
// retype it every time Expo Go reloads the app. Falls back to
// EXPO_PUBLIC_* env values (see .env.example) the first time, if set.
//
// The token can create transactions and submit allocations, so it goes in
// SecureStore (iOS Keychain / Android Keystore), not AsyncStorage, which
// is unencrypted on-disk storage. The base URL isn't sensitive and stays
// in AsyncStorage.
const BASE_URL_KEY = "ledger.connection.baseUrl";
const TOKEN_KEY = "ledger.connection.token";

export interface Connection {
  baseUrl: string;
  token: string;
}

export async function loadConnection(): Promise<Connection> {
  let baseUrl: string | null = null;
  let token: string | null = null;
  try {
    [baseUrl, token] = await Promise.all([
      AsyncStorage.getItem(BASE_URL_KEY),
      SecureStore.getItemAsync(TOKEN_KEY),
    ]);
  } catch {
    // fall through to defaults
  }
  return {
    baseUrl: baseUrl ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
    token: token ?? process.env.EXPO_PUBLIC_API_TOKEN ?? "",
  };
}

export async function saveConnection(connection: Connection): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(BASE_URL_KEY, connection.baseUrl),
    SecureStore.setItemAsync(TOKEN_KEY, connection.token),
  ]);
}

// Used by the Settings screen's "Disconnect" action -- clears the stored
// base URL/token locally. Doesn't call the API at all: it can't revoke
// the token itself (only the web app's Settings page can), just forget
// it on this device.
export async function clearConnection(): Promise<void> {
  await Promise.all([AsyncStorage.removeItem(BASE_URL_KEY), SecureStore.deleteItemAsync(TOKEN_KEY)]);
}
