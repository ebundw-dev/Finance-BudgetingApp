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
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SelectModal, type SelectSection } from "../components/SelectModal";
import { colors } from "../lib/theme";
import { ACCOUNT_TYPE_LABELS } from "../lib/accountTypes";
import { ApiError, updateAccount, type AccountType } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";
import type { AccountsStackParamList } from "../navigation/AccountsStack";

type Props = NativeStackScreenProps<AccountsStackParamList, "EditAccount">;

// No web equivalent to mirror (there's no account-edit page at all --
// see mobile/lib/api.ts's UpdateAccountInput comment): deliberately
// limited to name/type/cash-account, no starting-balance field here --
// balances only move through recorded transactions.
export default function EditAccountScreen({ route, navigation }: Props) {
  const { account } = route.params;
  const { connection } = useConnection();

  const [name, setName] = useState(account.name);
  const [type, setType] = useState<AccountType>(account.type);
  const [isCashAccount, setIsCashAccount] = useState(account.isCashAccount);
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

  const canSubmit = name.trim().length > 0 && !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await updateAccount(connection.baseUrl, connection.token, account.id, {
        name: name.trim(),
        type,
        isCashAccount,
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
          <TextInput style={styles.input} value={name} onChangeText={setName} autoFocus />

          <Text style={styles.label}>Account Type</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowTypePicker(true)}>
            <Text style={styles.pickerValue}>{ACCOUNT_TYPE_LABELS[type]}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Cash account</Text>
            <Switch
              value={isCashAccount}
              onValueChange={setIsCashAccount}
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
              <Text style={styles.submitButtonText}>Save Changes</Text>
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
  switchLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
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
