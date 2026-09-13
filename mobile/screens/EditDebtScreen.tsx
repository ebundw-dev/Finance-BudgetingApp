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
import { colors } from "../lib/theme";
import { ApiError, updateDebt } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";
import type { BudgetStackParamList } from "../navigation/BudgetStack";

type Props = NativeStackScreenProps<BudgetStackParamList, "EditDebt">;

// Mirrors src/app/(app)/debts/[id]/edit/page.tsx's fields exactly:
// startingBalance (required, non-negative -- editable, not fixed at
// creation), minimumPayment/apr/targetPayoffDate (all optional).
// accountId isn't shown/editable here either, matching web.
export default function EditDebtScreen({ route, navigation }: Props) {
  const { debt } = route.params;
  const { connection } = useConnection();

  const [startingBalance, setStartingBalance] = useState(debt.startingBalance);
  const [minimumPayment, setMinimumPayment] = useState(debt.minimumPayment ?? "");
  const [apr, setApr] = useState(debt.apr ?? "");
  const [targetPayoffDate, setTargetPayoffDate] = useState(debt.targetPayoffDate ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balanceValue = Number(startingBalance);
  const canSubmit =
    startingBalance.trim().length > 0 && Number.isFinite(balanceValue) && balanceValue >= 0 && !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await updateDebt(connection.baseUrl, connection.token, debt.id, {
        startingBalance: startingBalance.trim(),
        minimumPayment: minimumPayment.trim() || null,
        apr: apr.trim() || null,
        targetPayoffDate: targetPayoffDate.trim() || null,
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Starting Balance</Text>
          <TextInput
            style={styles.input}
            value={startingBalance}
            onChangeText={setStartingBalance}
            keyboardType="decimal-pad"
            autoFocus
          />

          <Text style={styles.label}>Minimum Payment (optional)</Text>
          <TextInput
            style={styles.input}
            value={minimumPayment}
            onChangeText={setMinimumPayment}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>APR % (optional)</Text>
          <TextInput
            style={styles.input}
            value={apr}
            onChangeText={setApr}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Target Payoff Date (optional)</Text>
          <TextInput
            style={styles.input}
            value={targetPayoffDate}
            onChangeText={setTargetPayoffDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.onAccent} />
            ) : (
              <Text style={styles.submitButtonText}>Save Changes</Text>
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
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: colors.onAccent,
    fontWeight: "700",
    fontSize: 15,
  },
});
