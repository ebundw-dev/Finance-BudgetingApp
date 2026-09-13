import AsyncStorage from "@react-native-async-storage/async-storage";

// Whether Face ID/Touch ID/passcode gating is required to view the app --
// a plain on/off preference, not sensitive, so it lives in AsyncStorage
// (not SecureStore, which stays reserved for the API token).
const APP_LOCK_KEY = "ledger.appLock.enabled";

export async function loadAppLockEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(APP_LOCK_KEY);
    if (raw === null) return true; // default on
    return raw === "true";
  } catch {
    return true;
  }
}

export async function saveAppLockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(APP_LOCK_KEY, enabled ? "true" : "false");
}
