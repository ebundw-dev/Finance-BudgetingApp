import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../lib/theme";

export function LockScreen({
  authenticating,
  errorMessage,
  onRetry,
}: {
  authenticating: boolean;
  errorMessage: string | null;
  onRetry: () => void;
}) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.badge}>
          <Ionicons name="finger-print" size={32} color={colors.accent} />
        </View>
        <Text style={styles.title}>Unlock Ledger</Text>
        <Text style={styles.subtitle}>Use Face ID, Touch ID, or your device passcode to continue.</Text>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        <TouchableOpacity style={styles.button} onPress={onRetry} disabled={authenticating}>
          {authenticating ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <Text style={styles.buttonText}>{errorMessage ? "Try Again" : "Unlock"}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.accent}1f`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  button: {
    marginTop: 14,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 13,
    minWidth: 150,
    alignItems: "center",
  },
  buttonText: {
    color: colors.onAccent,
    fontWeight: "700",
    fontSize: 15,
  },
});
