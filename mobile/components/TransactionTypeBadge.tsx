import { StyleSheet, Text, View } from "react-native";
import { toneBadgeBg, toneText } from "../lib/theme";
import { TRANSACTION_TYPE_LABELS, TRANSACTION_TYPE_TONE } from "../lib/transactionTypes";
import type { TransactionType } from "../lib/api";

// Mirrors the TYPE_BADGE pill used on both the web Transactions and
// Scheduled pages.
export function TransactionTypeBadge({ type }: { type: TransactionType }) {
  const tone = TRANSACTION_TYPE_TONE[type];
  return (
    <View style={[styles.pill, { backgroundColor: toneBadgeBg[tone] }]}>
      <Text style={[styles.text, { color: toneText[tone] }]}>{TRANSACTION_TYPE_LABELS[type]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
  },
});
