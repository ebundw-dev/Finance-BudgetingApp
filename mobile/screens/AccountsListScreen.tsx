import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { AccountRow } from "../components/AccountRow";
import { ScreenHeader } from "../components/ScreenHeader";
import { LoadingView } from "../components/LoadingView";
import { ErrorView } from "../components/ErrorView";
import { colors } from "../lib/theme";
import { ApiError, fetchAccounts, type Account } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";
import type { AccountsStackParamList } from "../navigation/AccountsStack";

type Phase = "loading" | "ready" | "error";

type Props = NativeStackScreenProps<AccountsStackParamList, "AccountsList">;

export default function AccountsListScreen({ navigation }: Props) {
  const { connection, openConnectionForm } = useConnection();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const runFetch = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) {
        setRefreshing(true);
        setRefreshError(null);
      } else {
        setPhase("loading");
      }
      try {
        const result = await fetchAccounts(connection.baseUrl, connection.token);
        setAccounts(result);
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

  // Refetch every time this tab/screen regains focus -- covers both
  // switching back to it and returning here after creating or editing an
  // account, same as TransactionsListScreen.
  useFocusEffect(
    useCallback(() => {
      runFetch(false);
    }, [runFetch])
  );

  if (phase === "loading") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <LoadingView label="Loading accounts…" />
      </SafeAreaView>
    );
  }

  if (phase === "error") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <ErrorView
          title="Couldn’t load accounts"
          message={errorMessage}
          onRetry={() => runFetch(false)}
          onChangeConnection={openConnectionForm}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => runFetch(true)} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader eyebrow="Accounts" title="Your accounts" />
            {refreshError ? (
              <View style={styles.refreshErrorBanner}>
                <Text style={styles.refreshErrorText}>Refresh failed: {refreshError}</Text>
              </View>
            ) : null}
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No accounts yet.</Text>}
        renderItem={({ item }) => (
          <AccountRow
            account={item}
            onPress={() => navigation.navigate("AccountDetail", { id: item.id, name: item.name })}
          />
        )}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("NewAccount")}
        accessibilityLabel="Add account"
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
    height: 12,
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
