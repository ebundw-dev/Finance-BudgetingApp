import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Card } from "../components/Card";
import { ProgressBar } from "../components/ProgressBar";
import { colors, toneBadgeBg, toneText } from "../lib/theme";
import { currency } from "../lib/format";
import type { BudgetStackParamList } from "../navigation/BudgetStack";

type Props = NativeStackScreenProps<BudgetStackParamList, "GoalDetail">;

// Read-only, and deliberately doesn't re-fetch: GET /api/goals/[id]
// actually returns a *lesser* shape than the list endpoint (the raw
// goals row, missing categoryName/allocatedBalance -- see
// mobile/lib/api.ts's GoalListRow comment), so the list screen's row is
// already strictly more complete than anything a detail fetch could add.
export default function GoalDetailScreen({ route }: Props) {
  const { goal } = route.params;
  const percent =
    goal.allocatedBalance !== null
      ? Math.round((Number(goal.allocatedBalance) / Number(goal.targetAmount)) * 100)
      : null;

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.badge}>
            <Ionicons name="flag" size={24} color={toneText.success} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name}>{goal.name}</Text>
            <Text style={styles.categoryName}>{goal.categoryName ?? "No linked category"}</Text>
          </View>
        </View>

        {percent !== null ? (
          <Card style={styles.progressCard}>
            <Text style={styles.percentValue}>{percent}%</Text>
            <View style={styles.progressBlock}>
              <ProgressBar percent={percent} />
              <View style={styles.progressLabels}>
                <Text style={styles.progressCurrent}>{currency(goal.allocatedBalance!)}</Text>
                <Text style={styles.progressTarget}>of {currency(goal.targetAmount)}</Text>
              </View>
            </View>
          </Card>
        ) : null}

        <Card style={styles.sectionCard}>
          <Row label="Target Amount" value={currency(goal.targetAmount)} />
          <Row label="Target Date" value={goal.targetDate ?? "—"} />
          <Row label="Linked Category" value={goal.categoryName ?? "None"} last />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: toneBadgeBg.success,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  categoryName: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  progressCard: {
    alignItems: "center",
    paddingVertical: 20,
  },
  percentValue: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 14,
  },
  progressBlock: {
    width: "100%",
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
  sectionCard: {
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  rowValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
});
