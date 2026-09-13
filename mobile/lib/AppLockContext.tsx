import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import { LoadingView } from "../components/LoadingView";
import { LockScreen } from "../components/LockScreen";
import { colors } from "./theme";
import { loadAppLockEnabled, saveAppLockEnabled } from "./appLock";

// How long the app can sit backgrounded before it re-locks on return.
// Anything under this (a quick app-switch, an incoming call banner) does
// not require re-authenticating.
const LOCK_THRESHOLD_MS = 60_000;

// Error codes meaning "there's nothing to authenticate against on this
// device" (no biometric hardware, nothing enrolled, no passcode set) --
// treated as an automatic pass-through rather than an unrecoverable lock,
// since the user would otherwise be permanently unable to open their own
// app.
const BYPASS_ERRORS = new Set(["not_enrolled", "not_available", "passcode_not_set"]);
// The user (or the OS) dismissed the system prompt -- not a real failure,
// just show the manual "Unlock" button again with no alarming message.
const CANCEL_ERRORS = new Set(["user_cancel", "app_cancel", "system_cancel"]);

interface AppLockContextValue {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
}

const AppLockContext = createContext<AppLockContextValue | null>(null);

export function useAppLock(): AppLockContextValue {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error("useAppLock must be used within AppLockProvider");
  return ctx;
}

// Gates the whole app behind Face ID/Touch ID/device passcode -- purely a
// client-side UI gate in front of whatever ConnectionProvider renders
// next; it doesn't touch the stored token/connection state at all. Wraps
// ConnectionProvider (see App.tsx) so the connect form itself is also
// hidden behind the lock, not just the authenticated screens.
export function AppLockProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabledState] = useState(true);
  const [locked, setLocked] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(async () => {
      const pref = await loadAppLockEnabled();
      if (cancelled) return;
      setEnabledState(pref);
      setLocked(pref);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function setEnabled(value: boolean) {
    setEnabledState(value);
    saveAppLockEnabled(value).catch(() => {});
    if (!value) {
      setLocked(false);
      setErrorMessage(null);
    }
  }

  const attemptUnlock = useCallback(async () => {
    setAuthenticating(true);
    setErrorMessage(null);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Ledger",
        fallbackLabel: "Use passcode",
        disableDeviceFallback: false,
      });
      if (result.success) {
        setLocked(false);
        return;
      }
      if (BYPASS_ERRORS.has(result.error)) {
        setLocked(false);
        return;
      }
      if (CANCEL_ERRORS.has(result.error)) {
        return;
      }
      if (result.error === "lockout") {
        setErrorMessage("Too many attempts. Try again later, or use your device passcode.");
        return;
      }
      setErrorMessage("Authentication failed. Try again.");
    } catch {
      setErrorMessage("Couldn't start authentication. Try again.");
    } finally {
      setAuthenticating(false);
    }
  }, []);

  // Auto-prompt whenever we transition into a locked state (initial load,
  // or re-locked after backgrounding) -- deferred a microtask so this
  // effect's setState calls happen after it returns, not synchronously
  // within it (react-hooks/set-state-in-effect; see DashboardScreen.tsx).
  useEffect(() => {
    if (!loaded || !enabled || !locked) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) attemptUnlock();
    });
    return () => {
      cancelled = true;
    };
  }, [loaded, enabled, locked, attemptUnlock]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        backgroundedAtRef.current = Date.now();
        return;
      }
      if (nextState === "active") {
        const backgroundedAt = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (enabled && backgroundedAt !== null && Date.now() - backgroundedAt >= LOCK_THRESHOLD_MS) {
          setLocked(true);
          setErrorMessage(null);
        }
      }
    });
    return () => subscription.remove();
  }, [enabled]);

  if (!loaded) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingView label="Loading…" />
      </SafeAreaView>
    );
  }

  if (enabled && locked) {
    return <LockScreen authenticating={authenticating} errorMessage={errorMessage} onRetry={attemptUnlock} />;
  }

  return <AppLockContext.Provider value={{ enabled, setEnabled }}>{children}</AppLockContext.Provider>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base,
  },
});
