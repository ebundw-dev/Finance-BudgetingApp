import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors } from "../lib/theme";
import type { Connection } from "../lib/connection";

// The one piece of manual setup this phase still needs: since there's no
// login screen yet (see mobile/README.md), the user pastes in a base URL
// and a token issued by the web app's Settings page. Shown on first launch,
// and again if the user taps "Change connection" from the Dashboard header.
export function ConnectionForm({
  initial,
  onSubmit,
  submitLabel = "Connect",
}: {
  initial: Connection;
  onSubmit: (connection: Connection) => void;
  submitLabel?: string;
}) {
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl);
  const [token, setToken] = useState(initial.token);

  return (
    <View>
      <Text style={styles.label}>API Base URL</Text>
      <TextInput
        style={styles.input}
        value={baseUrl}
        onChangeText={setBaseUrl}
        placeholder="https://your-tunnel.ngrok-free.app"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>API Token</Text>
      <TextInput
        style={styles.input}
        value={token}
        onChangeText={setToken}
        placeholder="paste a token from /settings"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />

      <TouchableOpacity
        style={[styles.button, (!baseUrl || !token) && styles.buttonDisabled]}
        onPress={() => onSubmit({ baseUrl: baseUrl.trim(), token: token.trim() })}
        disabled={!baseUrl || !token}
      >
        <Text style={styles.buttonText}>{submitLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: colors.surfaceHover,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.onAccent,
    fontWeight: "700",
    fontSize: 15,
  },
});
