import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Card } from "../components/Card";
import { LoadingView } from "../components/LoadingView";
import { ErrorView } from "../components/ErrorView";
import { colors, toneBadgeBg, toneText } from "../lib/theme";
import { currency } from "../lib/format";
import { ApiError, fetchAccount, type Account } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";
import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_TONE } from "../lib/accountTypes";
import type { AccountsStackParamList } from "../navigation/AccountsStack";

type Phase = "loading" | "ready" | "error";

type Props = NativeStackScreenProps<AccountsStackParamList, "AccountDetail">;

export default function AccountDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { connection, openConnectionForm } = useConnection();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const runFetch = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      else setPhase("loading");
      try {
        const result = await fetchAccount(connection.baseUrl, connection.token, id);
        setAccount(result);
        setPhase("ready");
      } catch (err) {
        setErrorMessage(err instanceof ApiError ? err.message : "Something went wrong.");
        setPhase("error");
      } finally {
        if (isRefresh) setRefreshing(false);
      }
    },
    [connection, id]
  );

  // Refetch on focus (not just mount) so returning from Edit shows the
  // saved changes immediately.
  useFocusEffect(
    useCallback(() => {
      runFetch(false);
    }, [runFetch])
  );

  if (phase === "loading") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <LoadingView label="Loading account…" />
      </SafeAreaView>
    );
  }

  if (phase === "error") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <ErrorView
          title="Couldn’t load account"
          message={errorMessage}
          onRetry={() => runFetch(false)}
          onChangeConnection={openConnectionForm}
        />
      </SafeAreaView>
    );
  }

  if (!account) return null;
  const tone = ACCOUNT_TYPE_TONE[account.type];

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => runFetch(true)} tintColor={colors.accent} />
        }
      >
        <View style={styles.headerRow}>
          <View style={[styles.badge, { backgroundColor: toneBadgeBg[tone] }]}>
            <Ionicons name={ACCOUNT_TYPE_ICONS[account.type]} size={24} color={toneText[tone]} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name}>{account.name}</Text>
            <Text style={styles.typeLabel}>{ACCOUNT_TYPE_LABELS[account.type]}</Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate("EditAccount", { account })}
          >
            <Ionicons name="pencil" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{account.isCashAccount ? "Balance" : "Owed"}</Text>
          <Text style={[styles.balanceValue, !account.isCashAccount && styles.balanceDanger]}>
            {currency(account.currentBalance)}
          </Text>
        </Card>

        <Card style={styles.sectionCard}>
          <Row label="Account Type" value={ACCOUNT_TYPE_LABELS[account.type]} />
          <Row label="Cash Account" value={account.isCashAccount ? "Yes" : "No"} />
          {account.isCashAccount ? (
            <Row
              label="Last Reconciled"
              value={account.lastReconciledAt ? account.lastReconciledAt.slice(0, 10) : "Never"}
            />
          ) : null}
          <Row label="Created" value={account.createdAt.slice(0, 10)} last />
        </Card>

        {account.isCashAccount ? (
          <TouchableOpacity
            style={styles.reconcileButton}
            onPress={() => navigation.navigate("ReconcileAccount", { account })}
          >
            <Ionicons name="checkmark-done-outline" size={17} color={colors.accent} />
            <Text style={styles.reconcileButtonText}>Reconcile</Text>
          </TouchableOpacity>
        ) : null}
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
  scrollContent: {
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
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  typeLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  balanceCard: {
    alignItems: "center",
    paddingVertical: 24,
  },
  balanceLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  balanceValue: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "700",
  },
  balanceDanger: {
    color: colors.danger,
  },
  sectionCard: {
    paddingVertical: 4,
  },
  reconcileButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: `${colors.accent}4d`,
    backgroundColor: `${colors.accent}14`,
    borderRadius: 10,
    paddingVertical: 13,
  },
  reconcileButtonText: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 14,
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
