import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../components/Card";
import { StatCard } from "../components/StatCard";
import { CategoryFundingRow } from "../components/CategoryFundingRow";
import { ConnectionForm } from "../components/ConnectionForm";
import { colors } from "../lib/theme";
import { currency } from "../lib/format";
import { ApiError, fetchDashboard, type DashboardData } from "../lib/api";
import { loadConnection, saveConnection, type Connection } from "../lib/connection";

type Phase = "loading" | "ready" | "error";

export default function DashboardScreen() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const runFetch = useCallback(async (conn: Connection, isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
      setRefreshError(null);
    } else {
      setPhase("loading");
    }
    try {
      const result = await fetchDashboard(conn.baseUrl, conn.token);
      setData(result);
      setPhase("ready");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong.";
      if (isRefresh) {
        setRefreshError(message);
      } else {
        setErrorMessage(message);
        setPhase("error");
      }
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const conn = await loadConnection();
      setConnection(conn);
      if (conn.baseUrl && conn.token) {
        runFetch(conn, false);
      } else {
        setShowConnectionForm(true);
        setPhase("ready");
      }
    })();
  }, [runFetch]);

  async function handleConnectionSubmit(conn: Connection) {
    await saveConnection(conn);
    setConnection(conn);
    setShowConnectionForm(false);
    runFetch(conn, false);
  }

  if (showConnectionForm || !connection) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.formScreen} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>Overview</Text>
          <Text style={styles.title}>Connect to Ledger</Text>
          <Text style={styles.subtitle}>
            Enter the API Base URL and token from the web app’s Settings page.
          </Text>
          {connection ? (
            <ConnectionForm initial={connection} onSubmit={handleConnectionSubmit} />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === "loading") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingLabel}>Loading dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "error") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <View style={styles.errorBadge}>
            <Ionicons name="alert-circle" size={26} color={colors.danger} />
          </View>
          <Text style={styles.errorTitle}>Couldn’t load dashboard</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => runFetch(connection, false)}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowConnectionForm(true)}>
            <Text style={styles.editConnectionLink}>Change connection</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) return null;
  const netPositive = Number(data.netFinancialPosition) >= 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => runFetch(connection, true)} tintColor={colors.accent} />
        }
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>Overview</Text>
            <Text style={styles.title}>Where you stand, today.</Text>
          </View>
          <TouchableOpacity style={styles.gearButton} onPress={() => setShowConnectionForm(true)}>
            <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {refreshError ? (
          <View style={styles.refreshErrorBanner}>
            <Text style={styles.refreshErrorText}>Refresh failed: {refreshError}</Text>
          </View>
        ) : null}

        {data.dueScheduledCount > 0 || data.upcomingScheduledCount > 0 ? (
          <Card style={[styles.alertCard, data.dueScheduledCount > 0 ? styles.alertCardDanger : styles.alertCardWarning]}>
            <View style={styles.alertRow}>
              <View
                style={[
                  styles.alertBadge,
                  { backgroundColor: data.dueScheduledCount > 0 ? `${colors.danger}1f` : `${colors.warning}1f` },
                ]}
              >
                <Ionicons name="notifications" size={17} color={data.dueScheduledCount > 0 ? colors.danger : colors.warning} />
              </View>
              <View style={styles.alertBody}>
                <Text style={styles.alertTitle}>
                  {data.dueScheduledCount > 0
                    ? `${data.dueScheduledCount} scheduled transaction${data.dueScheduledCount === 1 ? "" : "s"} due`
                    : `${data.upcomingScheduledCount} scheduled transaction${data.upcomingScheduledCount === 1 ? "" : "s"} coming up`}
                </Text>
                <Text style={styles.alertSubtitle}>
                  {data.dueScheduledCount > 0 && data.upcomingScheduledCount > 0
                    ? `Plus ${data.upcomingScheduledCount} more within 7 days.`
                    : "Review from the web app."}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {data.newSubscriptionCount > 0 ? (
          <Card style={[styles.alertCard, styles.alertCardAccent]}>
            <View style={styles.alertRow}>
              <View style={[styles.alertBadge, { backgroundColor: `${colors.accent}1f` }]}>
                <Ionicons name="radio" size={17} color={colors.accent} />
              </View>
              <View style={styles.alertBody}>
                <Text style={styles.alertTitle}>
                  {data.newSubscriptionCount} new subscription{data.newSubscriptionCount === 1 ? "" : "s"} detected
                </Text>
                <Text style={styles.alertSubtitle}>Found in your transaction history.</Text>
              </View>
            </View>
          </Card>
        ) : null}

        <View style={styles.statGrid}>
          <StatCard label="Total Cash" value={currency(data.totalCash)} tone="accent" icon="wallet" />
          <StatCard label="Unallocated Cash" value={currency(data.unallocatedCash)} tone="info" icon="cash" />
          <StatCard label="Total Debt" value={currency(data.totalDebt)} tone="danger" icon="card" />
          <StatCard
            label="Net Financial Position"
            value={currency(data.netFinancialPosition)}
            tone={netPositive ? "success" : "danger"}
            icon="trending-up"
          />
        </View>

        <View style={styles.statGrid}>
          <StatCard label="Income This Month" value={currency(data.incomeThisMonth)} tone="success" icon="arrow-down-circle" />
          <StatCard label="Spending This Month" value={currency(data.spendingThisMonth)} tone="warning" icon="arrow-up-circle" />
          <StatCard label="Debt Paid This Month" value={currency(data.debtPaidThisMonth)} tone="accent" icon="checkmark-circle" />
        </View>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Fund Progress</Text>
          {data.goalProgress.length === 0 ? (
            <Text style={styles.emptyText}>No goal categories with a target yet.</Text>
          ) : (
            <View style={styles.goalList}>
              {data.goalProgress.map((goal) => (
                <CategoryFundingRow key={goal.id} goal={goal} />
              ))}
            </View>
          )}
        </Card>

        <Card style={styles.sectionCard}>
          <Text style={styles.sectionHeading}>Earmarked</Text>
          {data.earmarked.length === 0 ? (
            <Text style={styles.emptyText}>Nothing earmarked yet.</Text>
          ) : (
            <View style={styles.earmarkedList}>
              {data.earmarked.map((category) => (
                <View key={category.name} style={styles.earmarkedRow}>
                  <Text style={styles.earmarkedName}>{category.name}</Text>
                  <Text style={styles.earmarkedValue}>{currency(category.allocatedBalance)}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
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
  formScreen: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  loadingLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  errorBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${colors.danger}1f`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  errorMessage: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 10,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  retryButtonText: {
    color: colors.onAccent,
    fontWeight: "700",
    fontSize: 14,
  },
  editConnectionLink: {
    color: colors.accent,
    fontSize: 13,
    marginTop: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 6,
  },
  gearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshErrorBanner: {
    backgroundColor: `${colors.danger}1f`,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  refreshErrorText: {
    color: colors.danger,
    fontSize: 12,
  },
  alertCard: {
    paddingVertical: 14,
  },
  alertCardDanger: {
    borderColor: `${colors.danger}4d`,
  },
  alertCardWarning: {
    borderColor: `${colors.warning}4d`,
  },
  alertCardAccent: {
    borderColor: `${colors.accent}4d`,
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  alertBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  alertBody: {
    flex: 1,
  },
  alertTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  alertSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  sectionCard: {},
  sectionHeading: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  goalList: {
    gap: 16,
  },
  earmarkedList: {
    gap: 10,
  },
  earmarkedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  earmarkedName: {
    color: colors.text,
    fontSize: 13,
  },
  earmarkedValue: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
