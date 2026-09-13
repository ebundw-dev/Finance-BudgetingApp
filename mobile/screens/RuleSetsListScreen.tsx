import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RuleSetCard } from "../components/RuleSetCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { LoadingView } from "../components/LoadingView";
import { ErrorView } from "../components/ErrorView";
import { colors } from "../lib/theme";
import { ApiError, fetchRuleSets, type RuleSet } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";
import type { BudgetStackParamList } from "../navigation/BudgetStack";

type Phase = "loading" | "ready" | "error";

type Props = NativeStackScreenProps<BudgetStackParamList, "Rules">;

export default function RuleSetsListScreen({ navigation }: Props) {
  const { connection, openConnectionForm } = useConnection();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      else setPhase("loading");
      try {
        const result = await fetchRuleSets(connection.baseUrl, connection.token);
        setRuleSets(result);
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
        <LoadingView label="Loading rule sets…" />
      </SafeAreaView>
    );
  }

  if (phase === "error") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <ErrorView
          title="Couldn’t load rule sets"
          message={errorMessage}
          onRetry={() => load(false)}
          onChangeConnection={openConnectionForm}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <FlatList
        data={ruleSets}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader eyebrow="Split it automatically" title="Rule Sets" />
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No rule sets yet.</Text>}
        renderItem={({ item }) => (
          <RuleSetCard ruleSet={item} onPress={() => navigation.navigate("RuleDetail", { ruleSet: item })} />
        )}
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
    paddingBottom: 40,
  },
  header: {
    marginBottom: 14,
  },
  separator: {
    height: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
  },
});
