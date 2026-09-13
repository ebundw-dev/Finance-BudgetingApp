import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../lib/theme";
import { useConnection } from "../lib/ConnectionContext";

// Extracted from the Phase 3 Dashboard screen: eyebrow + title + a gear
// icon that opens the connection form, shared across every top-level tab
// screen.
export function ScreenHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  const { openConnectionForm } = useConnection();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      <TouchableOpacity style={styles.gearButton} onPress={openConnectionForm}>
        <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  text: {
    flexShrink: 1,
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
  gearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
