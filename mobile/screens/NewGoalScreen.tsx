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
import { ApiError, createGoal, fetchCategories, type CategoryGroup } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";
import type { BudgetStackParamList } from "../navigation/BudgetStack";

type Props = NativeStackScreenProps<BudgetStackParamList, "NewGoal">;

const NO_CATEGORY = "__none__";

// Mirrors src/app/(app)/goals/new/page.tsx's fields exactly: name,
// targetAmount (required, positive), targetDate (optional), categoryId
// (optional, picked from every existing category -- web doesn't filter
// or offer to create a new one inline, so neither does this).
export default function NewGoalScreen({ navigation }: Props) {
  const { connection } = useConnection();

  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
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
        // Category linking is optional -- leave the list empty rather than
        // blocking the whole form on a category-fetch failure.
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

  const selectedCategoryName = categoryGroups.flatMap((g) => g.categories).find((c) => c.id === categoryId)?.name;

  const amountValue = Number(targetAmount);
  const canSubmit =
    name.trim().length > 0 && targetAmount.trim().length > 0 && Number.isFinite(amountValue) && amountValue > 0 && !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await createGoal(connection.baseUrl, connection.token, {
        name: name.trim(),
        targetAmount: targetAmount.trim(),
        targetDate: targetDate.trim() || null,
        categoryId,
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
            placeholder="e.g. Emergency Fund"
            placeholderTextColor={colors.textMuted}
            autoFocus
          />

          <Text style={styles.label}>Target Amount</Text>
          <TextInput
            style={styles.input}
            value={targetAmount}
            onChangeText={setTargetAmount}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />

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
            <Text style={selectedCategoryName ? styles.pickerValue : styles.pickerPlaceholder}>
              {loadingCategories ? "Loading…" : (selectedCategoryName ?? "None")}
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
              <Text style={styles.submitButtonText}>Add Goal</Text>
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
