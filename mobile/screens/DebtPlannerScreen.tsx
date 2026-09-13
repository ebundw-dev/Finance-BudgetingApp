import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Card } from "../components/Card";
import { ScreenHeader } from "../components/ScreenHeader";
import { LoadingView } from "../components/LoadingView";
import { ErrorView } from "../components/ErrorView";
import { colors, toneBadgeBg, toneText } from "../lib/theme";
import { currency } from "../lib/format";
import { comparePayoffStrategies, projectPayoffDate, type PlannerDebtInput, type PlannerStrategyResult } from "../lib/debtPlanner";
import { ApiError, fetchDebts, type DebtRow } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";

type Phase = "loading" | "ready" | "error";

// Mirrors the web Debt Payoff Planner (src/app/(app)/debts/planner/page.tsx
// + src/components/DebtPlannerClient.tsx): only debts with both an APR
// and a minimum payment (and a nonzero balance) have enough information
// to simulate, an extra-monthly-payment input, and a side-by-side
// avalanche vs snowball comparison via the ported mobile/lib/debtPlanner.ts.
export default function DebtPlannerScreen() {
  const { connection, openConnectionForm } = useConnection();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [extra, setExtra] = useState("0");

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      else setPhase("loading");
      try {
        const result = await fetchDebts(connection.baseUrl, connection.token);
        setDebts(result);
        setPhase("ready");
      } catch (err) {
        setErrorMessage(err instanceof ApiError ? err.message : "Something went wrong.");
        setPhase("error");
      } finally {
        if (isRefresh) setRefreshing(false);
      }
    },
    [connection]
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const plannerDebts: PlannerDebtInput[] = useMemo(
    () =>
      debts
        .filter((d) => d.apr !== null && d.minimumPayment !== null && Number(d.currentBalance) > 0)
        .map((d) => ({
          id: d.id,
          name: d.accountName,
          balance: Number(d.currentBalance),
          apr: Number(d.apr),
          minimumPayment: Number(d.minimumPayment),
        })),
    [debts]
  );

  const extraValue = Number(extra) || 0;
  const { avalanche, snowball } = useMemo(
    () => comparePayoffStrategies(plannerDebts, extraValue),
    [plannerDebts, extraValue]
  );
  const cheaper = Number(avalanche.totalInterestPaid) <= Number(snowball.totalInterestPaid) ? "avalanche" : "snowball";

  if (phase === "loading") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <LoadingView label="Loading debts…" />
      </SafeAreaView>
    );
  }

  if (phase === "error") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <ErrorView
          title="Couldn't load debts"
          message={errorMessage}
          onRetry={() => load(false)}
          onChangeConnection={openConnectionForm}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
      >
        <ScreenHeader eyebrow="A genuine step past a spreadsheet" title="Debt Payoff Planner" />

        {plannerDebts.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>
              No debts have both an APR and a minimum payment set (and a balance above zero) -- add
              those from the web app&apos;s debt edit page before comparing payoff strategies.
            </Text>
          </Card>
        ) : (
          <>
            <Card style={styles.extraCard}>
              <Text style={styles.label}>Extra monthly payment (on top of every minimum)</Text>
              <TextInput
                style={styles.input}
                value={extra}
                onChangeText={setExtra}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.hint}>
                Applied entirely to the highest-priority debt still open under each strategy -- a
                paid-off debt&apos;s own minimum rolls into that pool the month it&apos;s paid off.
              </Text>
            </Card>

            <StrategyCard
              title="Avalanche"
              description="Highest APR first -- minimizes total interest paid."
              result={avalanche}
              debts={plannerDebts}
              recommended={cheaper === "avalanche"}
            />
            <StrategyCard
              title="Snowball"
              description="Lowest balance first -- pays off individual debts sooner."
              result={snowball}
              debts={plannerDebts}
              recommended={cheaper === "snowball"}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StrategyCard({
  title,
  description,
  result,
  debts,
  recommended,
}: {
  title: string;
  description: string;
  result: PlannerStrategyResult;
  debts: PlannerDebtInput[];
  recommended: boolean;
}) {
  const debtName = (id: string) => debts.find((d) => d.id === id)?.name ?? id;

  return (
    <Card style={styles.strategyCard}>
      <View style={styles.strategyHeaderRow}>
        <Text style={styles.strategyTitle}>{title}</Text>
        {recommended ? (
          <View style={[styles.pill, { backgroundColor: toneBadgeBg.success }]}>
            <Text style={[styles.pillText, { color: toneText.success }]}>Less interest</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.strategyDescription}>{description}</Text>

      <View style={styles.summaryRow}>
        <View>
          <Text style={styles.summaryLabel}>Payoff date</Text>
          <Text style={styles.summaryValue}>
            {result.totalMonths !== null ? projectPayoffDate(result.totalMonths) : "50+ years"}
          </Text>
        </View>
        <View>
          <Text style={styles.summaryLabel}>Total interest</Text>
          <Text style={styles.summaryValue}>{currency(result.totalInterestPaid)}</Text>
        </View>
      </View>

      {result.order.map((id, index) => {
        const debt = result.debts.find((d) => d.id === id)!;
        return (
          <View key={id} style={[styles.debtRow, index === result.order.length - 1 && styles.debtRowLast]}>
            <Text style={styles.debtName} numberOfLines={1}>
              {debtName(id)}
            </Text>
            <View style={styles.debtValues}>
              <Text style={styles.debtPayoff}>
                {debt.payoffMonth !== null ? projectPayoffDate(debt.payoffMonth) : "50+ years"}
              </Text>
              <Text style={styles.debtInterest}>{currency(debt.totalInterestPaid)}</Text>
            </View>
          </View>
        );
      })}
    </Card>
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
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  extraCard: {},
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceHover,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 10,
    lineHeight: 16,
  },
  strategyCard: {},
  strategyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  strategyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  strategyDescription: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  debtRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  debtRowLast: {
    borderBottomWidth: 0,
  },
  debtName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  debtValues: {
    alignItems: "flex-end",
  },
  debtPayoff: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  debtInterest: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
});
