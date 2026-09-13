import AsyncStorage from "@react-native-async-storage/async-storage";

// Persists the API Base URL/token the user typed in so they don't have to
// retype it every time Expo Go reloads the app. Falls back to
// EXPO_PUBLIC_* env values (see .env.example) the first time, if set.
const STORAGE_KEY = "ledger.connection.v1";

export interface Connection {
  baseUrl: string;
  token: string;
}

export async function loadConnection(): Promise<Connection> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Connection;
  } catch {
    // fall through to defaults
  }
  return {
    baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
    token: process.env.EXPO_PUBLIC_API_TOKEN ?? "",
  };
}

export async function saveConnection(connection: Connection): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
}
