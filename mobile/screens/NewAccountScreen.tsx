import { useMemo, useState } from "react";
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
import { useNavigation, useRoute } from "@react-navigation/native";
import { SelectModal, type SelectSection } from "../components/SelectModal";
import { colors } from "../lib/theme";
import { ACCOUNT_TYPE_LABELS } from "../lib/accountTypes";
import { ApiError, createAccount, type AccountType } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";

// Registered under both AccountsStack ("NewAccount") and BudgetStack
// ("NewAccount", opened from the Debts list) -- there's no such thing as
// a standalone debt-create form on web (or here): a debt is always an
// account with "track as debt" checked (see src/lib/accounts/actions.ts's
// createAccount and its reserve-category setup), so both entry points
// share this exact screen. Typed loosely against route params rather
// than a single stack's NativeStackScreenProps so it can be registered
// in either.
export default function NewAccountScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const initialIsDebt = (route.params as { initialIsDebt?: boolean } | undefined)?.initialIsDebt ?? false;

  const { connection } = useConnection();

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [currentBalance, setCurrentBalance] = useState("0.00");
  const [isCashAccount, setIsCashAccount] = useState(true);
  const [isDebt, setIsDebt] = useState(initialIsDebt);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeSections: SelectSection[] = useMemo(
    () => [
      {
        title: "Account Type",
        options: (Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((value) => ({
          value,
          label: ACCOUNT_TYPE_LABELS[value],
        })),
      },
    ],
    []
  );

  const canSubmit = name.trim().length > 0 && !Number.isNaN(Number(currentBalance)) && !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await createAccount(connection.baseUrl, connection.token, {
        name: name.trim(),
        type,
        currentBalance: currentBalance.trim() || "0",
        isCashAccount,
        isDebt,
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
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Checking"
            placeholderTextColor={colors.textMuted}
            autoFocus
          />

          <Text style={styles.label}>Account Type</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowTypePicker(true)}>
            <Text style={styles.pickerValue}>{ACCOUNT_TYPE_LABELS[type]}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <Text style={styles.label}>Starting Balance</Text>
          <TextInput
            style={styles.input}
            value={currentBalance}
            onChangeText={setCurrentBalance}
            keyboardType="decimal-pad"
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Cash account</Text>
            <Switch
              value={isCashAccount}
              onValueChange={setIsCashAccount}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchTextBlock}>
              <Text style={styles.switchLabel}>Track as debt</Text>
              <Text style={styles.switchCaption}>Creates a linked reserve category for this account.</Text>
            </View>
            <Switch
              value={isDebt}
              onValueChange={setIsDebt}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surface}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.onAccent} />
            ) : (
              <Text style={styles.submitButtonText}>Add Account</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <SelectModal
        visible={showTypePicker}
        title="Account Type"
        sections={typeSections}
        selectedValue={type}
        onSelect={(value) => setType(value as AccountType)}
        onClose={() => setShowTypePicker(false)}
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
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    gap: 12,
  },
  switchTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  switchLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  switchCaption: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
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
