import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { TransactionRowItem } from "../components/TransactionRowItem";
import { ScreenHeader } from "../components/ScreenHeader";
import { LoadingView } from "../components/LoadingView";
import { ErrorView } from "../components/ErrorView";
import { colors } from "../lib/theme";
import { currentMonthRange } from "../lib/dates";
import { ApiError, fetchTransactions, type TransactionRow } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";
import type { TransactionsStackParamList } from "../navigation/TransactionsStack";

type Phase = "loading" | "ready" | "error";
const PAGE_SIZE = 30;

type Props = NativeStackScreenProps<TransactionsStackParamList, "TransactionsList">;

export default function TransactionsListScreen({ navigation }: Props) {
  const { connection, openConnectionForm } = useConnection();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFirstPage = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) {
        setRefreshing(true);
        setRefreshError(null);
      } else {
        setPhase("loading");
      }
      try {
        const { dateFrom, dateTo } = currentMonthRange();
        const result = await fetchTransactions(connection.baseUrl, connection.token, {
          dateFrom,
          dateTo,
          limit: PAGE_SIZE,
          offset: 0,
        });
        setRows(result.rows);
        setTotal(result.total);
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
    },
    [connection]
  );

  // Refetch the current month's first page whenever this tab regains
  // focus -- covers both switching back to it and returning here after
  // creating an expense on the New Expense screen, without needing to
  // plumb a manual refresh signal through navigation params.
  useFocusEffect(
    useCallback(() => {
      loadFirstPage(false);
    }, [loadFirstPage])
  );

  async function loadMore() {
    if (loadingMore || rows.length >= total) return;
    setLoadingMore(true);
    try {
      const { dateFrom, dateTo } = currentMonthRange();
      const result = await fetchTransactions(connection.baseUrl, connection.token, {
        dateFrom,
        dateTo,
        limit: PAGE_SIZE,
        offset: rows.length,
      });
      setRows((prev) => [...prev, ...result.rows]);
      setTotal(result.total);
    } catch {
      // Silently leave the "Load more" button in place so the user can retry.
    } finally {
      setLoadingMore(false);
    }
  }

  if (phase === "loading") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <LoadingView label="Loading transactions…" />
      </SafeAreaView>
    );
  }

  if (phase === "error") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <ErrorView
          title="Couldn’t load transactions"
          message={errorMessage}
          onRetry={() => loadFirstPage(false)}
          onChangeConnection={openConnectionForm}
        />
      </SafeAreaView>
    );
  }

  const hasMore = rows.length < total;

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadFirstPage(true)} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader eyebrow="This month" title="Transactions" />
            {refreshError ? (
              <View style={styles.refreshErrorBanner}>
                <Text style={styles.refreshErrorText}>Refresh failed: {refreshError}</Text>
              </View>
            ) : null}
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No transactions this month.</Text>}
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity style={styles.loadMoreButton} onPress={loadMore} disabled={loadingMore}>
              {loadingMore ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={styles.loadMoreText}>Load more</Text>
              )}
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item }) => (
          <TransactionRowItem transaction={item} onPress={() => navigation.navigate("EditTransaction", { id: item.id })} />
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("NewExpense")}
        accessibilityLabel="Add expense"
      >
        <Ionicons name="add" size={28} color={colors.onAccent} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 14,
    gap: 10,
  },
  separator: {
    height: 10,
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
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
  },
  loadMoreButton: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadMoreText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
