import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SelectModal, type SelectSection } from "../components/SelectModal";
import { colors } from "../lib/theme";
import { todayString } from "../lib/dates";
import {
  ApiError,
  createExpense,
  fetchAccounts,
  fetchCategories,
  type Account,
  type CategoryGroup,
} from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";
import type { TransactionsStackParamList } from "../navigation/TransactionsStack";

type Props = NativeStackScreenProps<TransactionsStackParamList, "NewExpense">;

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

  const amountValue = Number(amount);
  const canSubmit =
    !!accountId &&
    !!categoryId &&
    amount.trim().length > 0 &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    date.trim().length > 0 &&
    !submitting;

  async function handleSubmit() {
    if (!accountId || !categoryId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createExpense(connection.baseUrl, connection.token, {
        type: "expense",
        accountId,
        categoryId,
        amount: amount.trim(),
        date,
        source: source.trim() || undefined,
      });
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

              <Text style={styles.label}>Category</Text>
              <TouchableOpacity style={styles.pickerButton} onPress={() => setShowCategoryPicker(true)}>
                <Text style={selectedCategory ? styles.pickerValue : styles.pickerPlaceholder}>
                  {selectedCategory ? selectedCategory.name : "Choose a category"}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <Text style={styles.label}>Amount</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />

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
                  <Text style={styles.submitButtonText}>Add Expense</Text>
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
});
