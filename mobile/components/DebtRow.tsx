import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "./Card";
import { colors, toneBadgeBg, toneText } from "../lib/theme";
import { currency } from "../lib/format";
import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_TONE } from "../lib/accountTypes";
import type { DebtRow as DebtRowData } from "../lib/api";

// Mirrors the web Debts page's card header row (src/app/(app)/debts/page.tsx),
// which reuses the exact same account-type icon/tone mapping as Accounts --
// mobile/lib/accountTypes.ts is shared here rather than a separate debt
// icon mapping.
export function DebtRow({ debt, onPress }: { debt: DebtRowData; onPress: () => void }) {
  const tone = ACCOUNT_TYPE_TONE[debt.accountType];
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={styles.card}>
        <View style={[styles.badge, { backgroundColor: toneBadgeBg[tone] }]}>
          <Ionicons name={ACCOUNT_TYPE_ICONS[debt.accountType]} size={18} color={toneText[tone]} />
        </View>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {debt.accountName}
          </Text>
          <Text style={styles.reserved} numberOfLines={1}>
            Reserved: {currency(debt.reservedBalance)}
          </Text>
        </View>
        <View style={styles.owedBlock}>
          <Text style={styles.owedLabel}>Owed</Text>
          <Text style={styles.owedValue}>{currency(debt.currentBalance)}</Text>
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
  reserved: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  owedBlock: {
    alignItems: "flex-end",
  },
  owedLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    marginBottom: 2,
  },
  owedValue: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: "700",
  },
});
