import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SelectModal, type SelectSection } from "../components/SelectModal";
import { colors } from "../lib/theme";
import { currency } from "../lib/format";
import { todayString } from "../lib/dates";
import {
  ApiError,
  createExpense,
  createSplitExpense,
  fetchAccounts,
  fetchCategories,
  type Account,
  type CategoryGroup,
} from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";
import type { TransactionsStackParamList } from "../navigation/TransactionsStack";

type Props = NativeStackScreenProps<TransactionsStackParamList, "NewExpense">;

interface SplitRow {
  key: string;
  categoryId: string | null;
  categoryName: string | null;
  amount: string;
}

let nextSplitRowKey = 0;
function emptySplitRow(): SplitRow {
  nextSplitRowKey += 1;
  return { key: `split-${nextSplitRowKey}`, categoryId: null, categoryName: null, amount: "" };
}

export default function NewExpenseScreen({ navigation }: Props) {
  const { connection } = useConnection();

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);

  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [date, setDate] = useState(todayString());

  const [isSplit, setIsSplit] = useState(false);
  const [splits, setSplits] = useState<SplitRow[]>(() => [emptySplitRow(), emptySplitRow()]);
  const [splitPickerKey, setSplitPickerKey] = useState<string | null>(null);

  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoadingOptions(true);
      setOptionsError(null);
      try {
        const [accountRows, groups] = await Promise.all([
          fetchAccounts(connection.baseUrl, connection.token),
          fetchCategories(connection.baseUrl, connection.token),
        ]);
        // Same "spendable" filter as the web ExpenseForm: cash accounts
        // plus credit cards, not investment/other/debt-only accounts.
        setAccounts(accountRows.filter((a) => a.isCashAccount || a.type === "credit_card"));
        setCategoryGroups(groups);
      } catch (err) {
        setOptionsError(err instanceof ApiError ? err.message : "Something went wrong.");
      } finally {
        setLoadingOptions(false);
      }
    })();
  }, [connection]);

  const accountSections: SelectSection[] = useMemo(
    () => [
      {
        title: "Accounts",
        options: accounts.map((a) => ({ value: a.id, label: a.name, sublabel: a.type })),
      },
    ],
    [accounts]
  );

  const categorySections: SelectSection[] = useMemo(
    () =>
      categoryGroups.map((group) => ({
        title: group.name,
        options: group.categories.map((c) => ({ value: c.id, label: c.name })),
      })),
    [categoryGroups]
  );

  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;
  const selectedCategory = categoryGroups
    .flatMap((g) => g.categories)
    .find((c) => c.id === categoryId);
  const allCategories = useMemo(() => categoryGroups.flatMap((g) => g.categories), [categoryGroups]);

  function updateSplitRow(key: string, patch: Partial<SplitRow>) {
    setSplits((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }
  function addSplitRow() {
    setSplits((prev) => [...prev, emptySplitRow()]);
  }
  function removeSplitRow(key: string) {
    setSplits((prev) => (prev.length <= 2 ? prev : prev.filter((row) => row.key !== key)));
  }

  const splitTotal = splits.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const remaining = (Number(amount) || 0) - splitTotal;
  const splitIsBalanced = Math.abs(remaining) < 0.001 && Number(amount) > 0;

  const amountValue = Number(amount);
  const amountIsValid = amount.trim().length > 0 && Number.isFinite(amountValue) && amountValue > 0;
  const canSubmit =
    !!accountId &&
    amountIsValid &&
    date.trim().length > 0 &&
    !submitting &&
    (isSplit
      ? splitIsBalanced && splits.every((row) => row.categoryId && Number(row.amount) > 0)
      : !!categoryId);

  async function handleSubmit() {
    if (!accountId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (isSplit) {
        await createSplitExpense(connection.baseUrl, connection.token, {
          type: "split_expense",
          accountId,
          splits: splits
            .filter((row) => row.categoryId && Number(row.amount) > 0)
            .map((row) => ({ categoryId: row.categoryId!, amount: row.amount.trim() })),
          amount: amount.trim(),
          date,
          source: source.trim() || undefined,
        });
      } else {
        if (!categoryId) return;
        await createExpense(connection.baseUrl, connection.token, {
          type: "expense",
          accountId,
          categoryId,
          amount: amount.trim(),
          date,
          source: source.trim() || undefined,
        });
      }
      navigation.goBack();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {loadingOptions ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : optionsError ? (
            <View style={styles.centered}>
              <Text style={styles.errorText}>{optionsError}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Account</Text>
              <TouchableOpacity style={styles.pickerButton} onPress={() => setShowAccountPicker(true)}>
                <Text style={selectedAccount ? styles.pickerValue : styles.pickerPlaceholder}>
                  {selectedAccount ? selectedAccount.name : "Choose an account"}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              {allCategories.length >= 2 ? (
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Split into multiple categories</Text>
                  <Switch
                    value={isSplit}
                    onValueChange={setIsSplit}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor={colors.surface}
                  />
                </View>
              ) : null}

              {!isSplit ? (
                <>
                  <Text style={styles.label}>Category</Text>
                  <TouchableOpacity style={styles.pickerButton} onPress={() => setShowCategoryPicker(true)}>
                    <Text style={selectedCategory ? styles.pickerValue : styles.pickerPlaceholder}>
                      {selectedCategory ? selectedCategory.name : "Choose a category"}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </>
              ) : null}

              <Text style={styles.label}>Amount</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />

              {isSplit ? (
                <View style={styles.splitBlock}>
                  <View style={[styles.remainingBanner, splitIsBalanced && styles.remainingBannerBalanced]}>
                    <Text style={[styles.remainingLabel, splitIsBalanced && styles.remainingLabelBalanced]}>
                      Remaining to assign
                    </Text>
                    <Text style={[styles.remainingValue, splitIsBalanced && styles.remainingLabelBalanced]}>
                      {currency(remaining.toFixed(2))}
                    </Text>
                  </View>

                  {splits.map((row) => (
                    <View key={row.key} style={styles.splitRow}>
                      <TouchableOpacity
                        style={styles.splitCategoryButton}
                        onPress={() => setSplitPickerKey(row.key)}
                      >
                        <Text
                          style={row.categoryName ? styles.pickerValue : styles.pickerPlaceholder}
                          numberOfLines={1}
                        >
                          {row.categoryName ?? "Choose category"}
                        </Text>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.splitAmountInput}
                        value={row.amount}
                        onChangeText={(text) => updateSplitRow(row.key, { amount: text })}
                        placeholder="0.00"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                      />
                      <TouchableOpacity
                        style={[styles.removeSplitButton, splits.length <= 2 && styles.removeSplitButtonDisabled]}
                        onPress={() => removeSplitRow(row.key)}
                        disabled={splits.length <= 2}
                      >
                        <Ionicons name="close" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity style={styles.addSplitButton} onPress={addSplitRow}>
                    <Ionicons name="add" size={16} color={colors.accent} />
                    <Text style={styles.addSplitText}>Add category</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <Text style={styles.label}>Payee / description (optional)</Text>
              <TextInput
                style={styles.input}
                value={source}
                onChangeText={setSource}
                placeholder="e.g. Starbucks"
                placeholderTextColor={colors.textMuted}
              />

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

              {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

              <TouchableOpacity
                style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.onAccent} />
                ) : (
                  <Text style={styles.submitButtonText}>{isSplit ? "Add Split Expense" : "Add Expense"}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <SelectModal
        visible={showAccountPicker}
        title="Choose an account"
        sections={accountSections}
        selectedValue={accountId}
        onSelect={setAccountId}
        onClose={() => setShowAccountPicker(false)}
      />
      <SelectModal
        visible={showCategoryPicker}
        title="Choose a category"
        sections={categorySections}
        selectedValue={categoryId}
        onSelect={setCategoryId}
        onClose={() => setShowCategoryPicker(false)}
      />
      <SelectModal
        visible={splitPickerKey !== null}
        title="Choose a category"
        sections={categorySections}
        selectedValue={splits.find((row) => row.key === splitPickerKey)?.categoryId ?? null}
        onSelect={(value) => {
          if (!splitPickerKey) return;
          const name = allCategories.find((c) => c.id === value)?.name ?? null;
          updateSplitRow(splitPickerKey, { categoryId: value, categoryName: name });
        }}
        onClose={() => setSplitPickerKey(null)}
      />
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
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
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
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  switchLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  splitBlock: {
    marginTop: 12,
  },
  remainingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${colors.danger}66`,
    backgroundColor: `${colors.danger}1a`,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  remainingBannerBalanced: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  remainingLabel: {
    color: colors.danger,
    fontSize: 13,
  },
  remainingLabelBalanced: {
    color: colors.text,
  },
  remainingValue: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: "700",
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  splitCategoryButton: {
    flex: 1,
    backgroundColor: colors.surfaceHover,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  splitAmountInput: {
    width: 84,
    backgroundColor: colors.surfaceHover,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    textAlign: "right",
  },
  removeSplitButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  removeSplitButtonDisabled: {
    opacity: 0.3,
  },
  addSplitButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  addSplitText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
});
