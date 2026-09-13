import { useCallback, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { BarChart } from "react-native-gifted-charts";
import { Card } from "../components/Card";
import { ScreenHeader } from "../components/ScreenHeader";
import { LoadingView } from "../components/LoadingView";
import { ErrorView } from "../components/ErrorView";
import { colors } from "../lib/theme";
import { currency } from "../lib/format";
import { MONTH_NAMES, shiftMonth } from "../lib/dates";
import { ApiError, fetchSpendingReport, type CategorySpendingRow } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";

type Phase = "loading" | "ready" | "error";

// Only the top MAX_CHART_ROWS categories get a bar -- gifted-charts'
// BarChart (unlike web's recharts horizontal layout, see
// src/components/CategorySpendingChart.tsx's comment on why web goes
// horizontal) only draws upright bars, so category-name labels have to
// fit under a bar rather than next to one. The full list below the chart
// covers every category regardless, with untruncated names.
const MAX_CHART_ROWS = 8;
const CHART_WIDTH = Dimensions.get("window").width - 16 * 2 - 18 * 2;

function truncateLabel(name: string): string {
  return name.length > 8 ? `${name.slice(0, 7)}…` : name;
}

// Mirrors the web Spending Breakdown report
// (src/app/(app)/reports/spending/page.tsx): a month selector, a bar
// chart of spending by category for that month (sorted descending, same
// order the API already returns), and a full list below with amount and
// % of total per category.
export default function SpendingReportScreen() {
  const { connection, openConnectionForm } = useConnection();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [rows, setRows] = useState<CategorySpendingRow[]>([]);

  const load = useCallback(
    async (y: number, m: number) => {
      setPhase("loading");
      try {
        const result = await fetchSpendingReport(connection.baseUrl, connection.token, y, m);
        setRows(result);
        setPhase("ready");
      } catch (err) {
        setErrorMessage(err instanceof ApiError ? err.message : "Something went wrong.");
        setPhase("error");
      }
    },
    [connection]
  );

  useFocusEffect(
    useCallback(() => {
      load(year, month);
      // Only re-run when the screen regains focus or the selected month
      // changes -- not on every `load` identity change (which itself
      // depends on `connection`, already covered by focus).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [year, month])
  );

  function goToMonth(delta: number) {
    const next = shiftMonth(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
  }

  const totalSpending = rows.reduce((sum, row) => sum + Number(row.total), 0);
  const chartData = rows.slice(0, MAX_CHART_ROWS).map((row) => ({
    value: Number(row.total),
    label: truncateLabel(row.categoryName),
    frontColor: colors.accent,
  }));

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <ScreenHeader eyebrow="Where did it go" title="Spending Breakdown" />
        </View>

        <View style={styles.monthRow}>
          <TouchableOpacity style={styles.monthButton} onPress={() => goToMonth(-1)}>
            <Ionicons name="chevron-back" size={16} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>
            {MONTH_NAMES[month - 1]} {year}
          </Text>
          <TouchableOpacity style={styles.monthButton} onPress={() => goToMonth(1)}>
            <Ionicons name="chevron-forward" size={16} color={colors.text} />
          </TouchableOpacity>
        </View>

        {phase === "loading" ? (
          <LoadingView label="Loading…" />
        ) : phase === "error" ? (
          <ErrorView
            title="Couldn't load this report"
            message={errorMessage}
            onRetry={() => load(year, month)}
            onChangeConnection={openConnectionForm}
          />
        ) : rows.length === 0 ? (
          <Card>
            <Text style={styles.emptyText}>
              No spending recorded for {MONTH_NAMES[month - 1]} {year}.
            </Text>
          </Card>
        ) : (
          <>
            <Card style={styles.chartCard}>
              <Text style={styles.sectionHeading}>Spending by Category</Text>
              <BarChart
                data={chartData}
                width={CHART_WIDTH}
                height={200}
                barWidth={22}
                spacing={18}
                initialSpacing={12}
                barBorderRadius={4}
                yAxisThickness={0}
                xAxisColor={colors.border}
                rulesColor={colors.border}
                rulesType="dashed"
                noOfSections={4}
                yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
                isAnimated={false}
                disablePress
              />
            </Card>

            <Card style={styles.listCard}>
              <Text style={styles.sectionHeading}>By Category</Text>
              {rows.map((row, index) => {
                const percent = totalSpending > 0 ? ((Number(row.total) / totalSpending) * 100).toFixed(1) : null;
                return (
                  <View key={row.categoryId} style={[styles.row, index === rows.length - 1 && styles.rowLast]}>
                    <View style={styles.rowText}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {row.categoryName}
                      </Text>
                      <Text style={styles.rowGroup} numberOfLines={1}>
                        {row.groupName}
                      </Text>
                    </View>
                    <View style={styles.rowValues}>
                      <Text style={styles.rowAmount}>{currency(row.total)}</Text>
                      <Text style={styles.rowPercent}>{percent !== null ? `${percent}%` : "—"}</Text>
                    </View>
                  </View>
                );
              })}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{currency(totalSpending.toFixed(2))}</Text>
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
  header: {
    marginBottom: 0,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  monthButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    minWidth: 160,
    textAlign: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  chartCard: {
    paddingRight: 8,
  },
  listCard: {},
  sectionHeading: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  rowGroup: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  rowValues: {
    alignItems: "flex-end",
  },
  rowAmount: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  rowPercent: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  totalValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
});
