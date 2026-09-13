import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Card } from "./Card";
import { ProgressBar } from "./ProgressBar";
import { colors, toneBadgeBg, toneText } from "../lib/theme";
import { currency } from "../lib/format";
import { getCategoryFundingStatus } from "../lib/categoryTargets";
import type { Category } from "../lib/api";

const TYPE_TONE: Record<Category["categoryType"], keyof typeof toneBadgeBg> = {
  spending: "accent",
  goal: "success",
};

const PRIORITY_TONE: Record<NonNullable<Category["priority"]>, keyof typeof toneBadgeBg> = {
  P1: "danger",
  P2: "warning",
  P3: "accent",
  P4: "default",
};

// Mirrors the web Categories page's table row (src/app/(app)/categories/page.tsx):
// name + type/priority badges on the left, the same funding-status cell
// (CategoryFundingCell) on the right, collapsed into one tappable row
// since there's no room for real table columns on a phone.
export function CategoryRow({ category, onPress }: { category: Category; onPress: () => void }) {
  const status = getCategoryFundingStatus({
    targetType: category.targetType,
    targetAmount: category.targetAmount,
    targetDate: category.targetDate,
    allocatedBalance: category.allocatedBalance,
    allocatedThisMonth: category.allocatedThisMonth,
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card}>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {category.name}
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: toneBadgeBg[TYPE_TONE[category.categoryType]] }]}>
              <Text style={[styles.badgeText, { color: toneText[TYPE_TONE[category.categoryType]] }]}>
                {category.categoryType}
              </Text>
            </View>
            {category.priority ? (
              <View style={[styles.badge, { backgroundColor: toneBadgeBg[PRIORITY_TONE[category.priority]] }]}>
                <Text style={[styles.badgeText, { color: toneText[PRIORITY_TONE[category.priority]] }]}>
                  {category.priority}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.fundingBlock}>
          <FundingCell
            status={status}
            allocatedBalance={category.allocatedBalance}
            targetAmount={category.targetAmount}
            targetDate={category.targetDate}
          />
        </View>
      </Card>
    </TouchableOpacity>
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
      <View style={styles.refillBlock}>
        <Text style={[styles.refillCurrent, status.underfunded && styles.warningText]}>
          {currency(allocatedBalance)} of {currency(targetAmount!)}
        </Text>
        <ProgressBar percent={status.progressPercent} />
      </View>
    );
  }

  if (status.targetType === "set_aside_monthly") {
    return (
      <View
        style={[styles.pill, { backgroundColor: status.underfunded ? `${colors.danger}1f` : `${colors.success}1f` }]}
      >
        <Text style={{ color: status.underfunded ? colors.danger : colors.success, fontSize: 11, fontWeight: "600" }}>
          {status.underfunded ? "Not funded" : "Funded"}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.byDateBlock}>
      <Text style={[styles.byDateValue, status.underfunded && styles.dangerText]}>
        {currency(status.monthlyNeeded)}/mo
      </Text>
      {targetDate ? <Text style={styles.byDateDeadline}>by {targetDate}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  fundingBlock: {
    alignItems: "flex-end",
    maxWidth: 130,
  },
  plainValue: {
    color: colors.text,
    fontSize: 14,
  },
  refillBlock: {
    width: 130,
    gap: 4,
  },
  refillCurrent: {
    color: colors.textSecondary,
    fontSize: 11,
    textAlign: "right",
  },
  warningText: {
    color: colors.warning,
  },
  dangerText: {
    color: colors.danger,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  byDateBlock: {
    alignItems: "flex-end",
  },
  byDateValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  byDateDeadline: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
});
