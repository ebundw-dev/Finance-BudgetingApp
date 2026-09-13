import { StyleSheet, Text, View } from "react-native";
import { Card } from "./Card";
import { TransactionTypeBadge } from "./TransactionTypeBadge";
import { colors } from "../lib/theme";
import { currency } from "../lib/format";
import type { ScheduledTransactionRow } from "../lib/api";

// Upcoming items are informational only on web -- no confirm/skip
// actions, just description + type badge + due date + amount.
export function ScheduledUpcomingRow({ item }: { item: ScheduledTransactionRow }) {
  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.description} numberOfLines={1}>
          {item.description}
        </Text>
        <TransactionTypeBadge type={item.type} />
      </View>
      <View style={styles.bottomRow}>
        <Text style={styles.caption}>Due {item.nextDueDate}</Text>
        <Text style={styles.amount}>{currency(item.amount)}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {},
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  description: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 12,
  },
  amount: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
});
