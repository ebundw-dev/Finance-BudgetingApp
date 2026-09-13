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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SelectModal, type SelectSection } from "../components/SelectModal";
import { colors } from "../lib/theme";
import { ApiError, fetchCategories, updateGoal, type CategoryGroup } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";
import type { BudgetStackParamList } from "../navigation/BudgetStack";

type Props = NativeStackScreenProps<BudgetStackParamList, "EditGoal">;

const NO_CATEGORY = "__none__";

// Mirrors src/app/(app)/goals/[id]/edit/page.tsx's fields exactly (same
// as NewGoalScreen, prefilled). On success, jumps straight back to the
// Goals list rather than a plain goBack() -- GoalDetailScreen is purely
// prop-driven (see its own comment), so returning to it would show the
// stale pre-edit values until the user backed out further anyway.
export default function EditGoalScreen({ route, navigation }: Props) {
  const { goal } = route.params;
  const { connection } = useConnection();

  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [name, setName] = useState(goal.name);
  const [targetAmount, setTargetAmount] = useState(goal.targetAmount);
  const [targetDate, setTargetDate] = useState(goal.targetDate ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(goal.categoryId);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoadingCategories(true);
      try {
        const groups = await fetchCategories(connection.baseUrl, connection.token);
        setCategoryGroups(groups);
      } catch {
        // Non-fatal -- the currently linked category still shows via
        // goal.categoryName below even if the fetch for the picker fails.
      } finally {
        setLoadingCategories(false);
      }
    })();
  }, [connection]);

  const categorySections: SelectSection[] = useMemo(
    () => [
      { title: "No linked category", options: [{ value: NO_CATEGORY, label: "None" }] },
      ...categoryGroups.map((group) => ({
        title: group.name,
        options: group.categories.map((c) => ({ value: c.id, label: c.name })),
      })),
    ],
    [categoryGroups]
  );

  const pickedCategoryName = categoryGroups.flatMap((g) => g.categories).find((c) => c.id === categoryId)?.name;
  const displayCategoryName = pickedCategoryName ?? (categoryId === goal.categoryId ? goal.categoryName : null);

  const amountValue = Number(targetAmount);
  const canSubmit =
    name.trim().length > 0 && targetAmount.trim().length > 0 && Number.isFinite(amountValue) && amountValue > 0 && !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await updateGoal(connection.baseUrl, connection.token, goal.id, {
        name: name.trim(),
        targetAmount: targetAmount.trim(),
        targetDate: targetDate.trim() || null,
        categoryId,
      });
      navigation.navigate("Goals");
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

          <Text style={styles.label}>Target Amount</Text>
          <TextInput style={styles.input} value={targetAmount} onChangeText={setTargetAmount} keyboardType="decimal-pad" />

          <Text style={styles.label}>Target Date (optional)</Text>
          <TextInput
            style={styles.input}
            value={targetDate}
            onChangeText={setTargetDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Linked Category (optional)</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowCategoryPicker(true)}
            disabled={loadingCategories}
          >
            <Text style={displayCategoryName ? styles.pickerValue : styles.pickerPlaceholder}>
              {loadingCategories ? "Loading…" : (displayCategoryName ?? "None")}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>

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
        visible={showCategoryPicker}
        title="Linked Category"
        sections={categorySections}
        selectedValue={categoryId ?? NO_CATEGORY}
        onSelect={(value) => setCategoryId(value === NO_CATEGORY ? null : value)}
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
