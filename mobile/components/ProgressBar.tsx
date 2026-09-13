import { StyleSheet, View } from "react-native";
import { colors } from "../lib/theme";

// Mirrors src/components/ProgressBar.tsx.
export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const over = percent > 100;
  const width = Math.max(clamped, clamped > 0 ? 4 : 0);
  return (
    <View style={styles.track}>
      <View
        style={[styles.fill, { width: `${width}%`, backgroundColor: over ? colors.warning : colors.accent }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    width: "100%",
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
});
