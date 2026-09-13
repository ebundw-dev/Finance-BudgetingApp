import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { GoalCard } from "../components/GoalCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { LoadingView } from "../components/LoadingView";
import { ErrorView } from "../components/ErrorView";
import { colors } from "../lib/theme";
import { ApiError, fetchGoals, type GoalListRow } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";
import type { BudgetStackParamList } from "../navigation/BudgetStack";

type Phase = "loading" | "ready" | "error";

type Props = NativeStackScreenProps<BudgetStackParamList, "Goals">;

export default function GoalsListScreen({ navigation }: Props) {
  const { connection, openConnectionForm } = useConnection();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [goals, setGoals] = useState<GoalListRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      else setPhase("loading");
      try {
        const result = await fetchGoals(connection.baseUrl, connection.token);
        setGoals(result);
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

  if (phase === "loading") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <LoadingView label="Loading goals…" />
      </SafeAreaView>
    );
  }

  if (phase === "error") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <ErrorView
          title="Couldn’t load goals"
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
        data={goals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader eyebrow="Keep the horizon close" title="Goals" />
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No goals yet.</Text>}
        renderItem={({ item }) => (
          <GoalCard goal={item} onPress={() => navigation.navigate("GoalDetail", { goal: item })} />
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate("NewGoal")} accessibilityLabel="Add goal">
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
