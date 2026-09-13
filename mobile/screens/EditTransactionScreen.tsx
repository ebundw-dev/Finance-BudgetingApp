import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SelectModal, type SelectSection } from "../components/SelectModal";
import { TransactionTypeBadge } from "../components/TransactionTypeBadge";
import { LoadingView } from "../components/LoadingView";
import { ErrorView } from "../components/ErrorView";
import { colors } from "../lib/theme";
import { currency } from "../lib/format";
import {
  ApiError,
  deleteTransaction,
  fetchCategories,
  fetchTransaction,
  updateTransaction,
  type CategoryGroup,
  type TransactionDetail,
} from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";
import type { TransactionsStackParamList } from "../navigation/TransactionsStack";

type Phase = "loading" | "ready" | "error";
type Props = NativeStackScreenProps<TransactionsStackParamList, "EditTransaction">;

// A plain (non-split) expense is editable in place (category, amount,
// date, payee) via updateTransaction -- the same field set web's
// updateSplitExpenseAction supports for a split expense, generalized to
// a single category here since split editing isn't exposed on mobile
// yet. Every other type (income, transfer, debt payment, category
// reallocation, allocation, and split expenses) is read-only here and
// can only be deleted via deleteTransaction -- the first delete
// capability anywhere in the app, so there's no web page to mirror.
export default function EditTransactionScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { connection, openConnectionForm } = useConnection();

  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [txn, setTxn] = useState<TransactionDetail | null>(null);

  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [date, setDate] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const [detail, groups] = await Promise.all([
        fetchTransaction(connection.baseUrl, connection.token, id),
        fetchCategories(connection.baseUrl, connection.token),
      ]);
      setTxn(detail);
      setCategoryGroups(groups);
      setCategoryId(detail.categoryId);
      setAmount(detail.amount);
      setSource(detail.source ?? "");
      setDate(detail.date);
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

  const categorySections: SelectSection[] = useMemo(
    () =>
      categoryGroups.map((group) => ({
        title: group.name,
        options: group.categories.map((c) => ({ value: c.id, label: c.name })),
      })),
    [categoryGroups]
  );
  const selectedCategoryName = categoryGroups.flatMap((g) => g.categories).find((c) => c.id === categoryId)?.name;

  const isPlainExpense = txn?.type === "expense" && txn.categoryId !== null;

  const amountValue = Number(amount);
  const canSubmit =
    !!categoryId &&
    amount.trim().length > 0 &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    date.trim().length > 0 &&
    !submitting;

  async function handleSubmit() {
    if (!categoryId) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateTransaction(connection.baseUrl, connection.token, id, {
        categoryId,
        amount: amount.trim(),
        date,
        source: source.trim() || undefined,
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete this transaction?",
      "This reverses its effect on the account and category balances it touched. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: handleDelete },
      ]
    );
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteTransaction(connection.baseUrl, connection.token, id);
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setDeleting(false);
    }
  }

  if (phase === "loading") {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <LoadingView label="Loading transaction…" />
      </SafeAreaView>
    );
  }

  if (phase === "error" || !txn) {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <ErrorView
          title="Couldn't load this transaction"
          message={errorMessage}
          onRetry={load}
          onChangeConnection={openConnectionForm}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TransactionTypeBadge type={txn.type} />

          {isPlainExpense ? (
            <>
              <Text style={styles.label}>Category</Text>
              <TouchableOpacity style={styles.pickerButton} onPress={() => setShowCategoryPicker(true)}>
                <Text style={selectedCategoryName ? styles.pickerValue : styles.pickerPlaceholder}>
                  {selectedCategoryName ?? "Choose a category"}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <Text style={styles.label}>Amount</Text>
              <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />

              <Text style={styles.label}>Payee / description (optional)</Text>
              <TextInput style={styles.input} value={source} onChangeText={setSource} />

              <Text style={styles.label}>Date</Text>
              <TextInput
                style={styles.input}
                value={date}
                onChangeText={setDate}
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
            </>
          ) : (
            <View style={styles.readOnlyBlock}>
              <Row label="Amount" value={currency(txn.amount)} />
              <Row label="Date" value={txn.date} />
              {txn.accountName ? <Row label="Account" value={txn.accountName} /> : null}
              {txn.relatedAccountName ? <Row label="To account" value={txn.relatedAccountName} /> : null}
              {txn.categoryName ? <Row label="Category" value={txn.categoryName} /> : null}
              {txn.relatedCategoryName ? <Row label="To category" value={txn.relatedCategoryName} /> : null}
              {txn.source ? <Row label="Payee" value={txn.source} /> : null}
              {txn.splits.length > 0
                ? txn.splits.map((split) => (
                    <Row key={split.categoryId} label={split.categoryName} value={currency(split.amount)} />
                  ))
                : null}
              {txn.notes ? <Row label="Notes" value={txn.notes} /> : null}
              <Text style={styles.readOnlyHint}>
                This transaction type can only be deleted here, not edited.
              </Text>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
          )}

          <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete} disabled={deleting}>
            {deleting ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={styles.deleteButtonText}>Delete Transaction</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <SelectModal
        visible={showCategoryPicker}
        title="Choose a category"
        sections={categorySections}
        selectedValue={categoryId}
        onSelect={setCategoryId}
        onClose={() => setShowCategoryPicker(false)}
      />
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
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
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 4,
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
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceHover,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pickerValue: {
    color: colors.text,
    fontSize: 14,
  },
  pickerPlaceholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  readOnlyBlock: {
    marginTop: 16,
    gap: 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  rowValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
    marginLeft: 12,
  },
  readOnlyHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 14,
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
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${colors.danger}66`,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "600",
  },
});
