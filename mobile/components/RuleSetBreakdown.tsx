import { StyleSheet, Text, View } from "react-native";
import { colors } from "../lib/theme";
import type { RuleSetRow } from "../lib/api";

// Mirrors the web Rule Sets page's 5-color cycling palette
// (src/app/(app)/rules/page.tsx's SEGMENT_COLORS), used for both the
// segmented bar and each row's matching dot -- wraps with modulo for
// rule sets with more than 5 categories.
const SEGMENT_COLORS = [colors.accent, colors.success, colors.warning, colors.danger, colors.textSecondary];

export function RuleSetBreakdown({ rows }: { rows: RuleSetRow[] }) {
  return (
    <View>
      <View style={styles.bar}>
        {rows.map((row, i) => (
          <View
            key={row.id}
            style={{ width: `${Number(row.percentage)}%`, backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
          />
        ))}
      </View>
      <View style={styles.list}>
        {rows.map((row, i) => (
          <View key={row.id} style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.dot, { backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }]} />
              <Text style={styles.categoryName} numberOfLines={1}>
                {row.categoryName}
              </Text>
            </View>
            <Text style={styles.percentage}>{row.percentage}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 8,
    width: "100%",
    borderRadius: 4,
    backgroundColor: colors.base,
    overflow: "hidden",
    flexDirection: "row",
    marginBottom: 14,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryName: {
    color: colors.text,
    fontSize: 13,
    flexShrink: 1,
  },
  percentage: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
