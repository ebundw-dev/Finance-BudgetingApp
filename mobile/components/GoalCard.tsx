import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "./Card";
import { ProgressBar } from "./ProgressBar";
import { colors, toneBadgeBg, toneText } from "../lib/theme";
import { currency } from "../lib/format";
import type { GoalListRow } from "../lib/api";

// Mirrors the web Goals page's card (src/app/(app)/goals/page.tsx): a
// flat percent-of-target (allocatedBalance / targetAmount), NOT the
// refill_up_to/set_aside_monthly/by_date logic in
// mobile/lib/categoryTargets.ts -- goals are a separate system from
// category targets, computed with plain arithmetic, uncapped (can
// exceed 100%).
export function GoalCard({ goal, onPress }: { goal: GoalListRow; onPress: () => void }) {
  const percent =
    goal.allocatedBalance !== null
      ? Math.round((Number(goal.allocatedBalance) / Number(goal.targetAmount)) * 100)
      : null;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card>
        <View style={styles.headerRow}>
          <View style={styles.badge}>
            <Ionicons name="flag" size={20} color={toneText.success} />
          </View>
          {percent !== null ? (
            <View style={styles.percentPill}>
              <Text style={styles.percentPillText}>{percent}%</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.name}>{goal.name}</Text>
        <Text style={styles.categoryName}>{goal.categoryName ?? "No linked category"}</Text>

        {percent !== null ? (
          <View style={styles.progressBlock}>
            <ProgressBar percent={percent} />
            <View style={styles.progressLabels}>
              <Text style={styles.progressCurrent}>{currency(goal.allocatedBalance!)}</Text>
              <Text style={styles.progressTarget}>of {currency(goal.targetAmount)}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.flatTarget}>Target {currency(goal.targetAmount)}</Text>
        )}

        {goal.targetDate ? <Text style={styles.targetDate}>By {goal.targetDate}</Text> : null}
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: toneBadgeBg.success,
    alignItems: "center",
    justifyContent: "center",
  },
  percentPill: {
    backgroundColor: toneBadgeBg.success,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  percentPillText: {
    color: toneText.success,
    fontSize: 12,
    fontWeight: "700",
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  categoryName: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  progressBlock: {
    gap: 6,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressCurrent: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  progressTarget: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  flatTarget: {
    color: colors.text,
    fontSize: 14,
  },
  targetDate: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 10,
  },
});
