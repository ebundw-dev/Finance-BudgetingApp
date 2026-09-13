import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "./Card";
import { colors, toneBadgeBg, toneText } from "../lib/theme";
import { currency } from "../lib/format";
import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_TONE } from "../lib/accountTypes";
import type { Account } from "../lib/api";

// Mirrors the web Accounts page's card: type icon badge, name, type
// label, and balance (or "Owed" for non-cash/debt accounts, in danger
// tone) -- see src/app/(app)/accounts/page.tsx.
export function AccountRow({ account, onPress }: { account: Account; onPress: () => void }) {
  const tone = ACCOUNT_TYPE_TONE[account.type];
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card}>
        <View style={[styles.badge, { backgroundColor: toneBadgeBg[tone] }]}>
          <Ionicons name={ACCOUNT_TYPE_ICONS[account.type]} size={18} color={toneText[tone]} />
        </View>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {account.name}
          </Text>
          <Text style={styles.typeLabel}>{ACCOUNT_TYPE_LABELS[account.type]}</Text>
        </View>
        <View style={styles.balanceBlock}>
          <Text style={styles.balanceLabel}>{account.isCashAccount ? "Balance" : "Owed"}</Text>
          <Text style={[styles.balanceValue, !account.isCashAccount && styles.balanceDanger]}>
            {currency(account.currentBalance)}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
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
  typeLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  balanceBlock: {
    alignItems: "flex-end",
  },
  balanceLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    marginBottom: 2,
  },
  balanceValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  balanceDanger: {
    color: colors.danger,
  },
});
