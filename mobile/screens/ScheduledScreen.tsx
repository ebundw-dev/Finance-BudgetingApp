import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../components/ScreenHeader";
import { LoadingView } from "../components/LoadingView";
import { ErrorView } from "../components/ErrorView";
import { ScheduledDueRow } from "../components/ScheduledDueRow";
import { ScheduledUpcomingRow } from "../components/ScheduledUpcomingRow";
import { colors } from "../lib/theme";
import { ApiError, fetchScheduled, type ScheduledTransactionRow } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";

type Phase = "loading" | "ready" | "error";

export default function ScheduledScreen() {
  const { connection, openConnectionForm } = useConnection();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [due, setDue] = useState<ScheduledTransactionRow[]>([]);
  const [upcoming, setUpcoming] = useState<ScheduledTransactionRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      else setPhase("loading");
      try {
        const result = await fetchScheduled(connection.baseUrl, connection.token);
        setDue(result.due);
        setUpcoming(result.upcoming);
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
        <LoadingView label="Loading scheduled…" />
      </SafeAreaView>
    );
  }

  if (phase === "error") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <ErrorView
          title="Couldn’t load scheduled transactions"
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />
        }
      >
        <ScreenHeader eyebrow="Embrace your true expenses" title="Scheduled" />

        {due.length === 0 && upcoming.length === 0 ? (
          <Text style={styles.emptyText}>Nothing due or upcoming.</Text>
        ) : null}

        {due.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.dueSectionHeading}>Due ({due.length})</Text>
            <View style={styles.list}>
              {due.map((item) => (
                <ScheduledDueRow key={item.id} item={item} onDone={() => load(false)} />
              ))}
            </View>
          </View>
        ) : null}

        {upcoming.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Coming up in the next 7 days</Text>
            <View style={styles.list}>
              {upcoming.map((item) => (
                <ScheduledUpcomingRow key={item.id} item={item} />
              ))}
            </View>
          </View>
        ) : null}
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
    gap: 20,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
  },
  section: {
    gap: 12,
  },
  dueSectionHeading: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionHeading: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  list: {
    gap: 10,
  },
});
