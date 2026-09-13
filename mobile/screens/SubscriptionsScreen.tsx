import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { SubscriptionCard } from "../components/SubscriptionCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { LoadingView } from "../components/LoadingView";
import { ErrorView } from "../components/ErrorView";
import { colors } from "../lib/theme";
import {
  ApiError,
  createScheduledExpense,
  dismissSubscriptionCandidate,
  fetchSubscriptionCandidates,
  type SubscriptionCandidate,
} from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";

type Phase = "loading" | "ready" | "error";

function candidateKey(c: SubscriptionCandidate): string {
  return `${c.accountId}-${c.categoryId}-${c.payeeKey}`;
}

// Mirrors the web Subscriptions page (src/app/(app)/subscriptions/page.tsx):
// detection runs live on every load (see src/lib/subscriptions/detect.ts),
// no cached table. "Track it" posts the same shape
// createScheduledTransaction would (type "expense", pre-filled from the
// candidate) via POST /api/scheduled; "Dismiss" posts the account/
// category/payeeKey signature via POST /api/subscriptions/dismiss. Both
// just remove the card from the local list on success rather than
// re-fetching -- the candidate genuinely won't reappear next time either
// way (tracked -> excluded via existingSchedules, dismissed -> excluded
// via dismissedSubscriptionCandidates), so a full reload isn't needed.
export default function SubscriptionsScreen() {
  const { connection, openConnectionForm } = useConnection();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [candidates, setCandidates] = useState<SubscriptionCandidate[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"track" | "dismiss" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      else setPhase("loading");
      try {
        const result = await fetchSubscriptionCandidates(connection.baseUrl, connection.token);
        setCandidates(result);
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

  async function handleTrack(candidate: SubscriptionCandidate) {
    const key = candidateKey(candidate);
    setBusyKey(key);
    setBusyAction("track");
    setActionError(null);
    try {
      await createScheduledExpense(connection.baseUrl, connection.token, {
        type: "expense",
        description: candidate.payee,
        amount: candidate.averageAmount,
        cadence: candidate.cadence,
        nextDueDate: candidate.nextPredictedDate,
        accountId: candidate.accountId,
        categoryId: candidate.categoryId,
      });
      setCandidates((prev) => prev.filter((c) => candidateKey(c) !== key));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusyKey(null);
      setBusyAction(null);
    }
  }

  async function handleDismiss(candidate: SubscriptionCandidate) {
    const key = candidateKey(candidate);
    setBusyKey(key);
    setBusyAction("dismiss");
    setActionError(null);
    try {
      await dismissSubscriptionCandidate(connection.baseUrl, connection.token, {
        accountId: candidate.accountId,
        categoryId: candidate.categoryId,
        payeeKey: candidate.payeeKey,
      });
      setCandidates((prev) => prev.filter((c) => candidateKey(c) !== key));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusyKey(null);
      setBusyAction(null);
    }
  }

  if (phase === "loading") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <LoadingView label="Loading subscriptions…" />
      </SafeAreaView>
    );
  }

  if (phase === "error") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <ErrorView
          title="Couldn't load subscriptions"
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
        data={candidates}
        keyExtractor={candidateKey}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader eyebrow="Detected from your history" title="Subscriptions" />
            {actionError ? <Text style={styles.actionErrorText}>{actionError}</Text> : null}
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No new recurring charges detected. Candidates need at least 2 charges to the same account at a
            consistent amount and interval -- check back after more history, or look in Scheduled for anything
            already tracked.
          </Text>
        }
        renderItem={({ item }) => (
          <SubscriptionCard
            candidate={item}
            onTrack={() => handleTrack(item)}
            onDismiss={() => handleDismiss(item)}
            busy={busyKey === candidateKey(item) ? busyAction : null}
          />
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
    gap: 10,
  },
  separator: {
    height: 12,
  },
  actionErrorText: {
    color: colors.danger,
    fontSize: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
    lineHeight: 19,
  },
});
