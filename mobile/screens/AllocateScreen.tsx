import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../components/Card";
import { ScreenHeader } from "../components/ScreenHeader";
import { LoadingView } from "../components/LoadingView";
import { ErrorView } from "../components/ErrorView";
import { colors } from "../lib/theme";
import { currency } from "../lib/format";
import { ApiError, fetchAllocationState, submitAllocation, type Category } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";

type Phase = "loading" | "ready" | "error";

export default function AllocateScreen() {
  const { connection, openConnectionForm } = useConnection();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [unallocatedCash, setUnallocatedCash] = useState("0");
  const [categories, setCategories] = useState<Category[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      else setPhase("loading");
      try {
        const result = await fetchAllocationState(connection.baseUrl, connection.token);
        setUnallocatedCash(result.unallocatedCash);
        setCategories(result.categories);
        setAmounts(Object.fromEntries(result.categories.map((c) => [c.id, "0"])));
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
    // See mobile/screens/DashboardScreen.tsx for why this is deferred a
    // microtask (react-hooks/set-state-in-effect).
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
        <LoadingView label="Loading allocation…" />
      </SafeAreaView>
    );
  }

  if (phase === "error") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <ErrorView
          title="Couldn’t load allocation"
          message={errorMessage}
          onRetry={() => load(false)}
          onChangeConnection={openConnectionForm}
        />
      </SafeAreaView>
    );
  }

  const totalEntered = categories.reduce((sum, c) => sum + (Number(amounts[c.id]) || 0), 0);
  const remaining = Number(unallocatedCash) - totalEntered;
  const overAllocated = remaining < -0.001;

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      // Send every category's amount (including untouched "0" rows), same
      // as the web form -- the server's engine filters to positive
      // amounts itself, which is also what produces its friendlier
      // "must be greater than zero" message if everything was left at 0.
      await submitAllocation(connection.baseUrl, connection.token, {
        items: categories.map((c) => ({ categoryId: c.id, amount: amounts[c.id] || "0" })),
      });
      setSubmitSuccess(true);
      await load(false);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader eyebrow="Assign cash" title="Allocate" />
            <Card style={[styles.remainingCard, overAllocated && styles.remainingCardDanger]}>
              <Text style={[styles.remainingLabel, overAllocated && styles.remainingLabelDanger]}>
                Remaining to allocate
              </Text>
              <Text style={[styles.remainingValue, overAllocated && styles.remainingLabelDanger]}>
                {currency(remaining)}
              </Text>
            </Card>
            {submitSuccess ? (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>Allocation submitted.</Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.categoryName}>
                {item.name}
                {item.priority ? ` (${item.priority})` : ""}
              </Text>
              <Text style={styles.categoryBalance}>{currency(item.allocatedBalance)} current</Text>
            </View>
            <TextInput
              style={styles.amountInput}
              value={amounts[item.id] ?? "0"}
              onChangeText={(text) => setAmounts((prev) => ({ ...prev, [item.id]: text }))}
              keyboardType="decimal-pad"
            />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          <View style={styles.footer}>
            {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
            <TouchableOpacity
              style={[styles.submitButton, (overAllocated || submitting) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={overAllocated || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.onAccent} />
              ) : (
                <Text style={styles.submitButtonText}>Allocate</Text>
              )}
            </TouchableOpacity>
            {overAllocated ? (
              <Text style={styles.overAllocatedText}>Reduce amounts to match what’s available.</Text>
            ) : null}
          </View>
        }
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
    gap: 12,
  },
  remainingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  remainingCardDanger: {
    borderColor: `${colors.danger}66`,
    backgroundColor: `${colors.danger}14`,
  },
  remainingLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  remainingLabelDanger: {
    color: colors.danger,
  },
  remainingValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  successBanner: {
    backgroundColor: `${colors.success}1f`,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  successText: {
    color: colors.success,
    fontSize: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
  },
  categoryName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  categoryBalance: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  amountInput: {
    width: 90,
    backgroundColor: colors.surfaceHover,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    textAlign: "right",
  },
  separator: {
    height: 10,
  },
  footer: {
    marginTop: 16,
    gap: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: colors.onAccent,
    fontWeight: "700",
    fontSize: 15,
  },
  overAllocatedText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
  },
});
