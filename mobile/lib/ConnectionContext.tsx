import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoadingView } from "../components/LoadingView";
import { ConnectionForm } from "../components/ConnectionForm";
import { colors } from "./theme";
import { clearConnection, loadConnection, saveConnection, type Connection } from "./connection";

// Centralizes the "do we have a base URL + token yet" gate that used to
// live only in the Phase 3 Dashboard screen. Now every tab needs it, so
// it lives once here: ConnectionProvider itself renders the loading
// spinner / connect form and only mounts `children` (the actual app --
// NavigationContainer and its tabs) once a connection is in hand, which
// is what lets every screen's useConnection() assume `connection` is
// always set, no null-checking required.
interface ConnectionContextValue {
  connection: Connection;
  openConnectionForm: () => void;
  disconnect: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnection must be used within ConnectionProvider");
  return ctx;
}

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    (async () => {
      const conn = await loadConnection();
      setConnection(conn);
      setShowForm(!conn.baseUrl || !conn.token);
      setLoaded(true);
    })();
  }, []);

  async function handleSubmit(conn: Connection) {
    await saveConnection(conn);
    setConnection(conn);
    setShowForm(false);
  }

  async function disconnect() {
    await clearConnection();
    setConnection({ baseUrl: "", token: "" });
    setShowForm(true);
  }

  if (!loaded) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingView label="Loading…" />
      </SafeAreaView>
    );
  }

  if (showForm || !connection) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.formScreen} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>Overview</Text>
          <Text style={styles.title}>Connect to Ledger</Text>
          <Text style={styles.subtitle}>
            Enter the API Base URL and token from the web app’s Settings page.
          </Text>
          <ConnectionForm initial={connection ?? { baseUrl: "", token: "" }} onSubmit={handleSubmit} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <ConnectionContext.Provider value={{ connection, openConnectionForm: () => setShowForm(true), disconnect }}>
      {children}
    </ConnectionContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base,
  },
  formScreen: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 4,
  },
});
