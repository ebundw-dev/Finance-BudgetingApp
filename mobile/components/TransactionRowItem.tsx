import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Card } from "./Card";
import { colors, toneText } from "../lib/theme";
import { currency } from "../lib/format";
import { TRANSACTION_TYPE_TONE } from "../lib/transactionTypes";
import type { TransactionRow } from "../lib/api";

// Mirrors the web Transactions table row (src/app/(app)/transactions/page.tsx):
// date, payee-or-category, amount, and a Split indicator if the
// transaction has splits. Web only tones the type pill, not the amount --
// this phase's own requirement extends that tone to the amount itself.
// Tappable (onPress) to reach EditTransactionScreen -- editable there for a
// plain expense, read-only-plus-delete for every other type.
export function TransactionRowItem({ transaction, onPress }: { transaction: TransactionRow; onPress: () => void }) {
  const tone = TRANSACTION_TYPE_TONE[transaction.type];
  const label = transaction.source ?? transaction.categoryName ?? "—";

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.left}>
            <Text style={styles.date}>{transaction.date}</Text>
            <View style={styles.labelRow}>
              <Text style={styles.label} numberOfLines={1}>
                {label}
              </Text>
              {transaction.splits.length > 0 ? (
                <View style={styles.splitBadge}>
                  <Text style={styles.splitBadgeText}>Split</Text>
                </View>
              ) : null}
            </View>
          </View>
          <Text style={[styles.amount, { color: toneText[tone] }]}>{currency(transaction.amount)}</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  date: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 3,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  splitBadge: {
    backgroundColor: `${colors.accent}1f`,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  splitBadgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  amount: {
    fontSize: 15,
    fontWeight: "700",
  },
});
