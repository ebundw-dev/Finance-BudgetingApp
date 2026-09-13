import { useState } from "react";
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
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CategoryTargetFields, type CategoryTargetValue } from "../components/CategoryTargetFields";
import { colors } from "../lib/theme";
import { ApiError, updateCategory, type Category } from "../lib/api";
import { currency } from "../lib/format";
import { useConnection } from "../lib/ConnectionContext";
import type { BudgetStackParamList } from "../navigation/BudgetStack";

type Props = NativeStackScreenProps<BudgetStackParamList, "EditCategory">;

const PRIORITIES: { value: Category["priority"] | ""; label: string }[] = [
  { value: "", label: "None" },
  { value: "P1", label: "P1" },
  { value: "P2", label: "P2" },
  { value: "P3", label: "P3" },
  { value: "P4", label: "P4" },
];

// Mirrors src/app/(app)/categories/[id]/edit/page.tsx's fields exactly
// (name, the 4-way target selector via CategoryTargetFields, priority,
// archive toggle) -- groupId/categoryType stay uneditable here too,
// matching web. No delete button: every other mobile entity (Goals,
// Debts, Rule Sets) also has edit-only, no delete, and a category's own
// delete guard rails (zero balance, no history) mean archiving is the
// realistic path for anything that's actually been used.
export default function EditCategoryScreen({ route, navigation }: Props) {
  const { category } = route.params;
  const { connection } = useConnection();

  const [name, setName] = useState(category.name);
  const [target, setTarget] = useState<CategoryTargetValue>({
    targetType: category.targetType ?? "",
    targetAmount: category.targetAmount ?? "",
    targetCadence: category.targetCadence ?? "",
    targetDate: category.targetDate ?? "",
  });
  const [priority, setPriority] = useState<Category["priority"] | "">(category.priority ?? "");
  const [isArchived, setIsArchived] = useState(category.isArchived);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetAmountValue = Number(target.targetAmount);
  const canSubmit =
    name.trim().length > 0 &&
    !submitting &&
    (target.targetType === "" ||
      (target.targetAmount.trim().length > 0 &&
        Number.isFinite(targetAmountValue) &&
        targetAmountValue > 0 &&
        (target.targetType !== "by_date" || target.targetDate.trim().length > 0)));

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await updateCategory(connection.baseUrl, connection.token, category.id, {
        name: name.trim(),
        targetType: target.targetType === "" ? null : target.targetType,
        targetAmount: target.targetType === "" ? null : target.targetAmount.trim(),
        targetCadence: target.targetType === "refill_up_to" && target.targetCadence !== "" ? target.targetCadence : null,
        targetDate: target.targetType === "by_date" ? target.targetDate.trim() : null,
        priority: priority === "" ? null : priority,
        isArchived,
      });
      navigation.navigate("Categories");
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

          <Text style={styles.balanceText}>Current balance: {currency(category.allocatedBalance)}</Text>

          <CategoryTargetFields value={target} onChange={setTarget} />

          <Text style={styles.label}>Priority (used by Quick Payout Allocation)</Text>
          <View style={styles.pillRow}>
            {PRIORITIES.map((p) => {
              const selected = priority === p.value;
              return (
                <TouchableOpacity
                  key={p.value || "none"}
                  style={[styles.pill, selected && styles.pillSelected]}
                  onPress={() => setPriority(p.value)}
                >
                  <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.archiveRow}>
            <View style={styles.archiveText}>
              <Text style={styles.archiveLabel}>Archive</Text>
              <Text style={styles.archiveCaption}>
                Hides it from Categories, allocation, and Quick Payout -- balance is preserved and
                still counts toward Unallocated Cash.
              </Text>
            </View>
            <Switch
              value={isArchived}
              onValueChange={setIsArchived}
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
  balanceText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 8,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillSelected: {
    borderColor: colors.accent,
    backgroundColor: `${colors.accent}1f`,
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  pillTextSelected: {
    color: colors.accent,
    fontWeight: "600",
  },
  archiveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 20,
  },
  archiveText: {
    flex: 1,
    minWidth: 0,
  },
  archiveLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  archiveCaption: {
    color: colors.textMuted,
    fontSize: 12,
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
