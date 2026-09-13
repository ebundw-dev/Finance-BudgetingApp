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
import { ApiError, createCategory, fetchCategories, type CategoryGroup } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";
import type { BudgetStackParamList } from "../navigation/BudgetStack";

type Props = NativeStackScreenProps<BudgetStackParamList, "NewCategory">;

const CATEGORY_TYPES: { value: "spending" | "goal"; label: string }[] = [
  { value: "spending", label: "Spending" },
  { value: "goal", label: "Goal" },
];

// Mirrors src/app/(app)/categories/new/page.tsx's createCategory form
// (group, name, type) -- NOT the "add a new group" form above it on web,
// since a group's own name/sortOrder has no other mobile screen to manage
// it from yet. Groups must already exist (created on web) before a
// category can be added here.
export default function NewCategoryScreen({ navigation }: Props) {
  const { connection } = useConnection();

  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const [groupId, setGroupId] = useState<string | null>(null);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [name, setName] = useState("");
  const [categoryType, setCategoryType] = useState<"spending" | "goal">("spending");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoadingGroups(true);
      try {
        const groups = await fetchCategories(connection.baseUrl, connection.token);
        setCategoryGroups(groups);
        if (groups.length > 0) setGroupId(groups[0].id);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't load category groups.");
      } finally {
        setLoadingGroups(false);
      }
    })();
  }, [connection]);

  const groupSections: SelectSection[] = useMemo(
    () => [{ title: "Group", options: categoryGroups.map((g) => ({ value: g.id, label: g.name })) }],
    [categoryGroups]
  );
  const selectedGroupName = categoryGroups.find((g) => g.id === groupId)?.name;

  const canSubmit = groupId !== null && name.trim().length > 0 && !submitting;

  async function handleSubmit() {
    if (!groupId) return;
    setSubmitting(true);
    setError(null);
    try {
      await createCategory(connection.baseUrl, connection.token, {
        groupId,
        name: name.trim(),
        categoryType,
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
          {categoryGroups.length === 0 && !loadingGroups ? (
            <Text style={styles.errorText}>
              No category groups yet -- add one from the web app&apos;s Categories page first.
            </Text>
          ) : (
            <>
              <Text style={styles.label}>Group</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowGroupPicker(true)}
                disabled={loadingGroups}
              >
                <Text style={selectedGroupName ? styles.pickerValue : styles.pickerPlaceholder}>
                  {loadingGroups ? "Loading…" : (selectedGroupName ?? "Choose a group")}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <Text style={styles.label}>Name</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} autoFocus />

              <Text style={styles.label}>Type</Text>
              <View style={styles.pillRow}>
                {CATEGORY_TYPES.map((t) => {
                  const selected = categoryType === t.value;
                  return (
                    <TouchableOpacity
                      key={t.value}
                      style={[styles.pill, selected && styles.pillSelected]}
                      onPress={() => setCategoryType(t.value)}
                    >
                      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.onAccent} />
            ) : (
              <Text style={styles.submitButtonText}>Create Category</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <SelectModal
        visible={showGroupPicker}
        title="Group"
        sections={groupSections}
        selectedValue={groupId}
        onSelect={setGroupId}
        onClose={() => setShowGroupPicker(false)}
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
  pillRow: {
    flexDirection: "row",
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
