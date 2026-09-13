import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Card } from "../components/Card";
import { ProgressBar } from "../components/ProgressBar";
import { LoadingView } from "../components/LoadingView";
import { ErrorView } from "../components/ErrorView";
import { colors, toneBadgeBg, toneText } from "../lib/theme";
import { currency } from "../lib/format";
import { ApiError, fetchDebt, type DebtRow } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";
import { ACCOUNT_TYPE_ICONS, ACCOUNT_TYPE_TONE } from "../lib/accountTypes";
import type { BudgetStackParamList } from "../navigation/BudgetStack";

type Phase = "loading" | "ready" | "error";

type Props = NativeStackScreenProps<BudgetStackParamList, "DebtDetail">;

export default function DebtDetailScreen({ route }: Props) {
  const { id } = route.params;
  const { connection, openConnectionForm } = useConnection();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [debt, setDebt] = useState<DebtRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      else setPhase("loading");
      try {
        const result = await fetchDebt(connection.baseUrl, connection.token, id);
        setDebt(result);
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

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) load(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (phase === "loading") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <LoadingView label="Loading debt…" />
      </SafeAreaView>
    );
  }

  if (phase === "error") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <ErrorView
          title="Couldn’t load debt"
          message={errorMessage}
          onRetry={() => load(false)}
          onChangeConnection={openConnectionForm}
        />
      </SafeAreaView>
    );
  }

  if (!debt) return null;
  const tone = ACCOUNT_TYPE_TONE[debt.accountType];
  const starting = Number(debt.startingBalance);
  const current = Number(debt.currentBalance);
  const eliminated = starting - current;
  const percent = starting > 0 ? Math.round((eliminated / starting) * 100) : null;

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />
        }
      >
        <View style={styles.headerRow}>
          <View style={[styles.badge, { backgroundColor: toneBadgeBg[tone] }]}>
            <Ionicons name={ACCOUNT_TYPE_ICONS[debt.accountType]} size={24} color={toneText[tone]} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name}>{debt.accountName}</Text>
            <Text style={styles.reserved}>
              Reserved: {currency(debt.reservedBalance)} ({debt.categoryName})
            </Text>
          </View>
        </View>

        <Card style={styles.owedCard}>
          <Text style={styles.owedLabel}>Owed</Text>
          <Text style={styles.owedValue}>{currency(debt.currentBalance)}</Text>
        </Card>

        {percent !== null ? (
          <Card>
            <ProgressBar percent={percent} />
            <Text style={styles.eliminatedText}>
              {currency(eliminated)} eliminated of {currency(debt.startingBalance)} ({percent}%)
            </Text>
          </Card>
        ) : null}

        <Card style={styles.sectionCard}>
          <Row label="Min payment" value={debt.minimumPayment ? currency(debt.minimumPayment) : "—"} />
          <Row label="APR" value={debt.apr ? `${debt.apr}%` : "—"} />
          <Row label="Target payoff" value={debt.targetPayoffDate ?? "—"} last />
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
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  reserved: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  owedCard: {
    alignItems: "center",
    paddingVertical: 24,
  },
  owedLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  owedValue: {
    color: colors.danger,
    fontSize: 32,
    fontWeight: "700",
  },
  eliminatedText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 10,
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
