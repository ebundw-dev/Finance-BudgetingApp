import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Card } from "../components/Card";
import { LoadingView } from "../components/LoadingView";
import { ErrorView } from "../components/ErrorView";
import { colors, toneBadgeBg, toneText } from "../lib/theme";
import { currency } from "../lib/format";
import {
  ApiError,
  fetchAccounts,
  fetchCategories,
  fetchTransactionHistory,
  type Account,
  type CategoryGroup,
  type TransactionHistoryRow,
} from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";
import type { TransactionsStackParamList } from "../navigation/TransactionsStack";

type Phase = "loading" | "ready" | "error";
type Props = NativeStackScreenProps<TransactionsStackParamList, "TransactionHistory">;

interface Snapshot {
  type?: string;
  amount?: string;
  date?: string;
  source?: string | null;
  notes?: string | null;
  categoryId?: string | null;
  accountId?: string | null;
  splits?: { categoryId: string; amount: string }[];
}

interface DescribedRow {
  label: string;
  value: string;
}

// Mirrors the web transaction history page
// (src/app/(app)/transactions/[id]/history/page.tsx): most recent
// first, before/after for an edit, a single snapshot for a delete.
// Category/account names are resolved client-side the same way the web
// page resolves them server-side (a raw UUID in oldValues/newValues
// means nothing to a person) -- current names only; a renamed or
// since-deleted category/account falls back to "Unknown".
export default function TransactionHistoryScreen({ route }: Props) {
  const { id } = route.params;
  const { connection, openConnectionForm } = useConnection();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [history, setHistory] = useState<TransactionHistoryRow[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const [historyRows, groups, accountRows] = await Promise.all([
        fetchTransactionHistory(connection.baseUrl, connection.token, id),
        fetchCategories(connection.baseUrl, connection.token),
        fetchAccounts(connection.baseUrl, connection.token),
      ]);
      setHistory(historyRows);
      setCategoryGroups(groups);
      setAccounts(accountRows);
      setPhase("ready");
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }, [connection, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const categoryName = (categoryId: string | null | undefined) =>
    (categoryId && categoryGroups.flatMap((g) => g.categories).find((c) => c.id === categoryId)?.name) ??
    "Unknown category";
  const accountName = (accountId: string | null | undefined) =>
    (accountId && accounts.find((a) => a.id === accountId)?.name) ?? "Unknown account";

  function describe(snap: Snapshot | null): DescribedRow[] {
    if (!snap) return [];
    const rows: DescribedRow[] = [];
    if (snap.type) rows.push({ label: "Type", value: snap.type });
    if (snap.accountId) rows.push({ label: "Account", value: accountName(snap.accountId) });
    if (snap.amount !== undefined) rows.push({ label: "Amount", value: currency(snap.amount) });
    if (snap.date) rows.push({ label: "Date", value: snap.date });
    if (snap.source) rows.push({ label: "Payee", value: snap.source });
    if (snap.notes) rows.push({ label: "Notes", value: snap.notes });
    if (snap.categoryId) rows.push({ label: "Category", value: categoryName(snap.categoryId) });
    if (snap.splits && snap.splits.length > 0) {
      rows.push({
        label: "Splits",
        value: snap.splits.map((s) => `${categoryName(s.categoryId)}: ${currency(s.amount)}`).join(", "),
      });
    }
    return rows;
  }

  if (phase === "loading") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <LoadingView label="Loading history…" />
      </SafeAreaView>
    );
  }

  if (phase === "error") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <ErrorView title="Couldn't load history" message={errorMessage} onRetry={load} onChangeConnection={openConnectionForm} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {history.length === 0 ? (
          <Text style={styles.emptyText}>No changes recorded for this transaction.</Text>
        ) : (
          history.map((entry) => {
            const oldRows = describe(entry.oldValues as Snapshot);
            const newRows = describe(entry.newValues as Snapshot | null);
            const tone = entry.action === "deleted" ? "danger" : "accent";
            return (
              <Card key={entry.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <View style={[styles.pill, { backgroundColor: toneBadgeBg[tone] }]}>
                    <Text style={[styles.pillText, { color: toneText[tone] }]}>
                      {entry.action === "deleted" ? "Deleted" : "Edited"}
                    </Text>
                  </View>
                  <Text style={styles.timestamp}>{new Date(entry.changedAt).toLocaleString()}</Text>
                </View>

                <Text style={styles.sectionLabel}>{entry.action === "deleted" ? "At the time it was deleted" : "Before"}</Text>
                {oldRows.map((r) => (
                  <Row key={r.label} label={r.label} value={r.value} />
                ))}

                {entry.action === "updated" ? (
                  <>
                    <Text style={[styles.sectionLabel, styles.afterLabel]}>After</Text>
                    {newRows.map((r) => (
                      <Row key={r.label} label={r.label} value={r.value} />
                    ))}
                  </>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: DescribedRow) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
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
    gap: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
  },
  entryCard: {},
  entryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  timestamp: {
    color: colors.textMuted,
    fontSize: 11,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  afterLabel: {
    marginTop: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4,
  },
  rowLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  rowValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
});
