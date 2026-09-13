import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ProgressBar } from "./ProgressBar";
import { colors } from "../lib/theme";
import { currency } from "../lib/format";
import { getCategoryFundingStatus } from "../lib/categoryTargets";
import type { GoalCategoryProgress } from "../lib/api";

// Mirrors src/components/CategoryFundingCell.tsx + the Dashboard's list-item
// wrapper around it (icon badge + name + funding cell) as one row.
export function CategoryFundingRow({ goal }: { goal: GoalCategoryProgress }) {
  const status = getCategoryFundingStatus({
    targetType: goal.targetType,
    targetAmount: goal.targetAmount,
    targetDate: goal.targetDate,
    allocatedBalance: goal.allocatedBalance,
    allocatedThisMonth: goal.allocatedThisMonth,
  });
  const underfunded = status?.underfunded ?? false;

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.badge,
          { backgroundColor: underfunded ? `${colors.danger}1f` : `${colors.accent}1f` },
        ]}
      >
        <Ionicons name="flag" size={15} color={underfunded ? colors.danger : colors.accent} />
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{goal.name}</Text>
        <FundingCell status={status} allocatedBalance={goal.allocatedBalance} targetAmount={goal.targetAmount} targetDate={goal.targetDate} />
      </View>
    </View>
  );
}

function FundingCell({
  status,
  allocatedBalance,
  targetAmount,
  targetDate,
}: {
  status: ReturnType<typeof getCategoryFundingStatus>;
  allocatedBalance: string;
  targetAmount: string | null;
  targetDate: string | null;
}) {
  if (!status) {
    return <Text style={styles.plainValue}>{currency(allocatedBalance)}</Text>;
  }

  if (status.targetType === "refill_up_to") {
    return (
      <View>
        <View style={styles.progressLabels}>
          <Text style={[styles.progressCurrent, status.underfunded && styles.warningText]}>
            {currency(allocatedBalance)}
          </Text>
          <Text style={styles.progressTarget}>of {currency(targetAmount!)}</Text>
        </View>
        <ProgressBar percent={status.progressPercent} />
      </View>
    );
  }

  if (status.targetType === "set_aside_monthly") {
    return (
      <View
        style={[
          styles.pill,
          { backgroundColor: status.underfunded ? `${colors.danger}1f` : `${colors.success}1f` },
        ]}
      >
        <Text style={{ color: status.underfunded ? colors.danger : colors.success, fontSize: 12, fontWeight: "600" }}>
          {status.underfunded ? "Not funded this month" : "Funded this month"}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={[styles.byDateValue, status.underfunded && styles.dangerText]}>
        {currency(status.monthlyNeeded)}/mo
      </Text>
      {targetDate ? <Text style={styles.byDateDeadline}>by {targetDate}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  plainValue: {
    color: colors.text,
    fontSize: 13,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressCurrent: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  progressTarget: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  warningText: {
    color: colors.warning,
  },
  dangerText: {
    color: colors.danger,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  byDateValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  byDateDeadline: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
});
