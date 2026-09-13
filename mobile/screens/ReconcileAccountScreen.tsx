import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Card } from "../components/Card";
import { colors } from "../lib/theme";
import { currency } from "../lib/format";
import { ApiError, reconcileAccount, type ReconcileAccountResult } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";
import type { AccountsStackParamList } from "../navigation/AccountsStack";

type Props = NativeStackScreenProps<AccountsStackParamList, "ReconcileAccount">;

// Mirrors src/app/(app)/accounts/[id]/reconcile/page.tsx exactly: shows
// Ledger's computed balance and when it was last reconciled, takes a
// statement balance + optional notes, and posts through the same
// recordReconciliation engine function via POST
// /api/accounts/[id]/reconcile. A match records no transaction; a
// surplus/shortfall posts one adjustment (rejected server-side if a
// shortfall would take Unallocated Cash below zero).
export default function ReconcileAccountScreen({ route, navigation }: Props) {
  const { account } = route.params;
  const { connection } = useConnection();

  const [statementBalance, setStatementBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReconcileAccountResult | null>(null);

  const amountValue = Number(statementBalance);
  const canSubmit = statementBalance.trim().length > 0 && Number.isFinite(amountValue) && !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await reconcileAccount(connection.baseUrl, connection.token, account.id, {
        statementBalance: statementBalance.trim(),
        notes: notes.trim() || undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const delta = Number(result.delta);
    return (
      <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Card style={styles.resultCard}>
            <Text style={styles.resultTitle}>
              {result.matched ? "Already matched" : delta > 0 ? "Surplus posted" : "Shortfall posted"}
            </Text>
            <Text style={styles.resultBody}>
              {result.matched
                ? "No adjustment was needed -- the statement balance matched Ledger's computed balance."
                : `Posted an adjustment of ${currency(Math.abs(delta).toFixed(2))} to bring the account in line with your statement.`}
            </Text>
            <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Ledger&apos;s computed balance</Text>
            <Text style={styles.balanceValue}>{currency(account.currentBalance)}</Text>
            <Text style={styles.balanceCaption}>
              {account.lastReconciledAt
                ? `Last reconciled ${account.lastReconciledAt.slice(0, 10)} at ${currency(
                    account.lastReconciledBalance ?? "0"
                  )}`
                : "Never reconciled."}
            </Text>
          </Card>

          <Text style={styles.label}>Statement balance (as of today)</Text>
          <TextInput
            style={styles.input}
            value={statementBalance}
            onChangeText={setStatementBalance}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            autoFocus
          />

          <Text style={styles.label}>Notes (optional -- what explains the difference?)</Text>
          <TextInput style={styles.input} value={notes} onChangeText={setNotes} />

          <Text style={styles.hint}>
            If the balances already match, this just records that you checked -- no adjustment is
            posted. Otherwise this posts a single adjustment transaction: a surplus raises
            Unallocated Cash, a shortfall lowers it (and is rejected if there isn&apos;t enough
            Unallocated Cash to absorb it).
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.onAccent} />
            ) : (
              <Text style={styles.submitButtonText}>Reconcile</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  balanceCard: {
    alignItems: "center",
    paddingVertical: 20,
    marginBottom: 8,
  },
  balanceLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  balanceValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    marginTop: 8,
  },
  balanceCaption: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 8,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.surfaceHover,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 14,
    lineHeight: 16,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginTop: 14,
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: colors.onAccent,
    fontWeight: "700",
    fontSize: 15,
  },
  resultCard: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 10,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  resultBody: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  doneButton: {
    marginTop: 10,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  doneButtonText: {
    color: colors.onAccent,
    fontWeight: "700",
    fontSize: 14,
  },
});
