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
import { ApiError, fetchCategories, updateRuleSet, type CategoryGroup } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";
import type { BudgetStackParamList } from "../navigation/BudgetStack";

type Props = NativeStackScreenProps<BudgetStackParamList, "EditRuleSet">;

interface EditableRow {
  key: string;
  categoryId: string | null;
  categoryName: string | null;
  percentage: string;
}

let nextRowKey = 0;
function emptyRow(): EditableRow {
  nextRowKey += 1;
  return { key: `row-${nextRowKey}`, categoryId: null, categoryName: null, percentage: "" };
}

// No web equivalent (the web app can only create a new rule set or
// delete one entirely, never edit rows in place) -- this replaces every
// row on save rather than diffing, matching src/lib/api/rules.ts's
// updateRuleSet. The name isn't editable here: renaming would just be
// deleting the old name and creating a new one, which is exactly what
// "delete + create new" already does on web.
export default function EditRuleSetScreen({ route, navigation }: Props) {
  const { ruleSet } = route.params;
  const { connection } = useConnection();

  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [rows, setRows] = useState<EditableRow[]>(() =>
    ruleSet.rows.map((row) => {
      nextRowKey += 1;
      return {
        key: `row-${nextRowKey}`,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        percentage: row.percentage,
      };
    })
  );
  const [pickerRowKey, setPickerRowKey] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoadingCategories(true);
      try {
        const groups = await fetchCategories(connection.baseUrl, connection.token);
        setCategoryGroups(groups);
      } catch {
        // Non-fatal -- the currently-linked category names still show via
        // the rows already prefilled from ruleSet above.
      } finally {
        setLoadingCategories(false);
      }
    })();
  }, [connection]);

  const categorySections: SelectSection[] = useMemo(
    () =>
      categoryGroups.map((group) => ({
        title: group.name,
        options: group.categories.map((c) => ({ value: c.id, label: c.name })),
      })),
    [categoryGroups]
  );

  function updateRow(key: string, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length <= 2 ? prev : prev.filter((row) => row.key !== key)));
  }

  const total = rows.reduce((sum, row) => sum + (Number(row.percentage) || 0), 0);
  const validRowCount = rows.filter((row) => row.categoryId && Number(row.percentage) > 0).length;
  const canSubmit = validRowCount >= 2 && !submitting;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await updateRuleSet(connection.baseUrl, connection.token, ruleSet.name, {
        rows: rows
          .filter((row) => row.categoryId && Number(row.percentage) > 0)
          .map((row) => ({ categoryId: row.categoryId!, percentage: row.percentage.trim() })),
      });
      navigation.navigate("Rules");
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
          <Text style={styles.label}>Categories</Text>
          {rows.map((row) => (
            <View key={row.key} style={styles.row}>
              <TouchableOpacity
                style={styles.categoryButton}
                onPress={() => setPickerRowKey(row.key)}
                disabled={loadingCategories}
              >
                <Text style={row.categoryName ? styles.pickerValue : styles.pickerPlaceholder} numberOfLines={1}>
                  {loadingCategories ? "Loading…" : (row.categoryName ?? "Choose category")}
                </Text>
              </TouchableOpacity>
              <TextInput
                style={styles.percentageInput}
                value={row.percentage}
                onChangeText={(text) => updateRow(row.key, { percentage: text })}
                placeholder="%"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={[styles.removeButton, rows.length <= 2 && styles.removeButtonDisabled]}
                onPress={() => removeRow(row.key)}
                disabled={rows.length <= 2}
              >
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addRowButton} onPress={addRow}>
            <Ionicons name="add" size={16} color={colors.accent} />
            <Text style={styles.addRowText}>Add category</Text>
          </TouchableOpacity>

          <Text style={[styles.totalText, Math.abs(total - 100) > 0.01 && styles.totalTextOff]}>
            Total: {Math.round(total * 100) / 100}%
          </Text>

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
        visible={pickerRowKey !== null}
        title="Choose a category"
        sections={categorySections}
        selectedValue={rows.find((r) => r.key === pickerRowKey)?.categoryId ?? null}
        onSelect={(value) => {
          if (!pickerRowKey) return;
          const name = categoryGroups.flatMap((g) => g.categories).find((c) => c.id === value)?.name ?? null;
          updateRow(pickerRowKey, { categoryId: value, categoryName: name });
        }}
        onClose={() => setPickerRowKey(null)}
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  categoryButton: {
    flex: 1,
    backgroundColor: colors.surfaceHover,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerValue: {
    color: colors.text,
    fontSize: 14,
  },
  pickerPlaceholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  percentageInput: {
    width: 64,
    backgroundColor: colors.surfaceHover,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    textAlign: "right",
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  removeButtonDisabled: {
    opacity: 0.3,
  },
  addRowButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 12,
  },
  addRowText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  totalText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "right",
  },
  totalTextOff: {
    color: colors.danger,
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
