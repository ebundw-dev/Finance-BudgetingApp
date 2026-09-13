import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../lib/theme";

// Extracted from the Phase 3 Dashboard screen so every screen's
// failed-load state (with retry + optional "change connection") looks
// and behaves the same.
export function ErrorView({
  title,
  message,
  onRetry,
  onChangeConnection,
}: {
  title: string;
  message: string;
  onRetry: () => void;
  onChangeConnection?: () => void;
}) {
  return (
    <View style={styles.centered}>
      <View style={styles.badge}>
        <Ionicons name="alert-circle" size={26} color={colors.danger} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
      {onChangeConnection ? (
        <TouchableOpacity onPress={onChangeConnection}>
          <Text style={styles.link}>Change connection</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${colors.danger}1f`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  message: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 10,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  retryButtonText: {
    color: colors.onAccent,
    fontWeight: "700",
    fontSize: 14,
  },
  link: {
    color: colors.accent,
    fontSize: 13,
    marginTop: 6,
  },
});
