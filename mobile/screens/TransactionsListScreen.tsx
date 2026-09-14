import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { TransactionRowItem } from "../components/TransactionRowItem";
import { ScreenHeader } from "../components/ScreenHeader";
import { LoadingView } from "../components/LoadingView";
import { ErrorView } from "../components/ErrorView";
import { TransactionFiltersModal, EMPTY_FILTERS, type TransactionFilters } from "../components/TransactionFiltersModal";
import { colors } from "../lib/theme";
import { currentMonthRange } from "../lib/dates";
import {
  ApiError,
  fetchAccounts,
  fetchCategories,
  fetchTransactions,
  type Account,
  type CategoryGroup,
  type TransactionRow,
} from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";
import type { TransactionsStackParamList } from "../navigation/TransactionsStack";

type Phase = "loading" | "ready" | "error";
const PAGE_SIZE = 30;

type Props = NativeStackScreenProps<TransactionsStackParamList, "TransactionsList">;

// Defaults to "this month, no other filters" -- the same window the
// screen always showed before Phase 12's search/filtering.
function defaultFilters(): TransactionFilters {
  const { dateFrom, dateTo } = currentMonthRange();
  return { ...EMPTY_FILTERS, dateFrom, dateTo };
}

function isFiltered(filters: TransactionFilters, search: string): boolean {
  const defaults = defaultFilters();
  return (
    search.trim().length > 0 ||
    filters.categoryId !== null ||
    filters.accountId !== null ||
    filters.dateFrom !== defaults.dateFrom ||
    filters.dateTo !== defaults.dateTo ||
    filters.amountMin !== "" ||
    filters.amountMax !== ""
  );
}

export default function TransactionsListScreen({ navigation }: Props) {
  const { connection, openConnectionForm } = useConnection();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filters, setFilters] = useState<TransactionFilters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [groups, accountRows] = await Promise.all([
          fetchCategories(connection.baseUrl, connection.token),
          fetchAccounts(connection.baseUrl, connection.token),
        ]);
        setCategoryGroups(groups);
        setAccounts(accountRows);
      } catch {
        // The filter modal's pickers just show empty sections if this
        // fails -- non-fatal, the transaction list itself doesn't depend
        // on it.
      }
    })();
  }, [connection]);

  const loadFirstPage = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) {
        setRefreshing(true);
        setRefreshError(null);
      } else {
        setPhase("loading");
      }
      try {
        const result = await fetchTransactions(connection.baseUrl, connection.token, {
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          categoryId: filters.categoryId ?? undefined,
          accountId: filters.accountId ?? undefined,
          amountMin: filters.amountMin || undefined,
          amountMax: filters.amountMax || undefined,
          search: appliedSearch || undefined,
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
    [connection, filters, appliedSearch]
  );

  // Refetch whenever this tab regains focus (covers returning from New
  // Expense) or the applied filters/search change.
  useFocusEffect(
    useCallback(() => {
      loadFirstPage(false);
    }, [loadFirstPage])
  );

  async function loadMore() {
    if (loadingMore || rows.length >= total) return;
    setLoadingMore(true);
    try {
      const result = await fetchTransactions(connection.baseUrl, connection.token, {
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        categoryId: filters.categoryId ?? undefined,
        accountId: filters.accountId ?? undefined,
        amountMin: filters.amountMin || undefined,
        amountMax: filters.amountMax || undefined,
        search: appliedSearch || undefined,
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

  const filtered = isFiltered(filters, appliedSearch);

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
            <ScreenHeader eyebrow={filtered ? "Filtered" : "This month"} title="Transactions" />

            <View style={styles.searchRow}>
              <View style={styles.searchInputWrapper}>
                <Ionicons name="search" size={15} color={colors.textMuted} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  value={searchInput}
                  onChangeText={setSearchInput}
                  onSubmitEditing={() => setAppliedSearch(searchInput.trim())}
                  placeholder="Search payee…"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="search"
                />
                {searchInput.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchInput("");
                      setAppliedSearch("");
                    }}
                  >
                    <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity
                style={[styles.filterButton, filtered && styles.filterButtonActive]}
                onPress={() => setShowFilters(true)}
                accessibilityLabel="Filters"
              >
                <Ionicons name="options" size={18} color={filtered ? colors.onAccent : colors.text} />
              </TouchableOpacity>
            </View>

            {refreshError ? (
              <View style={styles.refreshErrorBanner}>
                <Text style={styles.refreshErrorText}>Refresh failed: {refreshError}</Text>
              </View>
            ) : null}
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{filtered ? "No transactions match these filters." : "No transactions this month."}</Text>
        }
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

      <TransactionFiltersModal
        visible={showFilters}
        initial={filters}
        categoryGroups={categoryGroups}
        accounts={accounts}
        onApply={setFilters}
        onClose={() => setShowFilters(false)}
      />
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
    gap: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceHover,
    borderRadius: 8,
    paddingHorizontal: 10,
    gap: 6,
  },
  searchIcon: {
    marginTop: 1,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 10,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.surfaceHover,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonActive: {
    backgroundColor: colors.accent,
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
