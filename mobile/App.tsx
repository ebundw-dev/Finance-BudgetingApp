import { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// Phase 2 test screen only: prove mobile -> API -> DB round trip via a
// single manual fetch. No navigation, no persistence beyond these two
// fields' initial values, no styling beyond legibility. See
// mobile/README.md for what to do with this screen.

const DEFAULT_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";
const DEFAULT_TOKEN = process.env.EXPO_PUBLIC_API_TOKEN ?? "";

export default function App() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [token, setToken] = useState(DEFAULT_TOKEN);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState("");

  async function fetchDashboard() {
    setStatus("loading");
    setResult("");
    try {
      const url = `${baseUrl.replace(/\/$/, "")}/api/dashboard`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await response.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // not JSON -- show raw text as-is
      }
      setResult(`HTTP ${response.status}\n\n${pretty}`);
      setStatus(response.ok ? "success" : "error");
    } catch (err) {
      setResult(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      setStatus("error");
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <Text style={styles.title}>Ledger — API test</Text>

        <Text style={styles.label}>API Base URL</Text>
        <TextInput
          style={styles.input}
          value={baseUrl}
          onChangeText={setBaseUrl}
          placeholder="https://your-tunnel.ngrok-free.app"
          placeholderTextColor="#5c7d73"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>API Token</Text>
        <TextInput
          style={styles.input}
          value={token}
          onChangeText={setToken}
          placeholder="paste a token from /settings"
          placeholderTextColor="#5c7d73"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.button}
          onPress={fetchDashboard}
          disabled={status === "loading" || !baseUrl || !token}
        >
          <Text style={styles.buttonText}>
            {status === "loading" ? "Fetching..." : "Fetch Dashboard"}
          </Text>
        </TouchableOpacity>

        {status !== "idle" && (
          <Text style={[styles.statusLabel, status === "error" && styles.statusError]}>
            {status === "success" ? "Success" : status === "error" ? "Error" : "Loading"}
          </Text>
        )}

        <ScrollView style={styles.resultBox}>
          <Text style={styles.resultText}>{result}</Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f211d",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    color: "#5cd6ad",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
  },
  label: {
    color: "#a9c5bc",
    fontSize: 13,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#16302a",
    color: "#eaf5f1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  button: {
    backgroundColor: "#5cd6ad",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    color: "#0f211d",
    fontWeight: "700",
    fontSize: 15,
  },
  statusLabel: {
    color: "#5cd6ad",
    marginTop: 12,
    fontSize: 13,
    fontWeight: "600",
  },
  statusError: {
    color: "#e0755c",
  },
  resultBox: {
    flex: 1,
    marginTop: 16,
    backgroundColor: "#0a1815",
    borderRadius: 8,
    padding: 12,
  },
  resultText: {
    color: "#c8ded7",
    fontFamily: "monospace",
    fontSize: 12,
  },
});
