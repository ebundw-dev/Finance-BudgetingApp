import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "../lib/theme";

// Extracted from the Phase 3 Dashboard screen so every screen's initial
// load spinner looks and behaves the same.
export function LoadingView({ label }: { label: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.label}>{label}</Text>
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
  label: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
