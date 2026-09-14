import { useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { SelectModal, type SelectSection } from "./SelectModal";
import { colors } from "../lib/theme";
import type { Account, CategoryGroup } from "../lib/api";

export interface TransactionFilters {
  categoryId: string | null;
  accountId: string | null;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
}

export const EMPTY_FILTERS: TransactionFilters = {
  categoryId: null,
  accountId: null,
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
};

// A full-screen modal for the filters that change less often than search
// text (category/account/date-range/amount-range) -- search itself stays
// an always-visible field on TransactionsListScreen, matching a typical
// "search bar + filter sheet" split rather than cramming everything into
// one modal.
export function TransactionFiltersModal({
  visible,
  initial,
  categoryGroups,
  accounts,
  onApply,
  onClose,
}: {
  visible: boolean;
  initial: TransactionFilters;
  categoryGroups: CategoryGroup[];
  accounts: Account[];
  onApply: (filters: TransactionFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<TransactionFilters>(initial);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  const categorySections: SelectSection[] = useMemo(
    () => [
      { title: "Any category", options: [{ value: "", label: "Any category" }] },
      ...categoryGroups.map((group) => ({
        title: group.name,
        options: group.categories.map((c) => ({ value: c.id, label: c.name })),
      })),
    ],
    [categoryGroups]
  );
  const accountSections: SelectSection[] = useMemo(
    () => [
      {
        title: "Accounts",
        options: [{ value: "", label: "Any account" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))],
      },
    ],
    [accounts]
  );

  const categoryName = categoryGroups.flatMap((g) => g.categories).find((c) => c.id === draft.categoryId)?.name;
  const accountName = accounts.find((a) => a.id === draft.accountId)?.name;

  function handleOpen() {
    setDraft(initial);
  }

  function handleApply() {
    onApply(draft);
    onClose();
  }

  function handleClear() {
    setDraft(EMPTY_FILTERS);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={handleOpen}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Filters</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Category</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowCategoryPicker(true)}>
            <Text style={categoryName ? styles.pickerValue : styles.pickerPlaceholder}>
              {categoryName ?? "Any category"}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <Text style={styles.label}>Account</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowAccountPicker(true)}>
            <Text style={accountName ? styles.pickerValue : styles.pickerPlaceholder}>
              {accountName ?? "Any account"}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.row}>
            <View style={styles.rowField}>
              <Text style={styles.label}>From</Text>
              <TextInput
                style={styles.input}
                value={draft.dateFrom}
                onChangeText={(text) => setDraft((d) => ({ ...d, dateFrom: text }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.rowField}>
              <Text style={styles.label}>To</Text>
              <TextInput
                style={styles.input}
                value={draft.dateTo}
                onChangeText={(text) => setDraft((d) => ({ ...d, dateTo: text }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.rowField}>
              <Text style={styles.label}>Min $</Text>
              <TextInput
                style={styles.input}
                value={draft.amountMin}
                onChangeText={(text) => setDraft((d) => ({ ...d, amountMin: text }))}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.rowField}>
              <Text style={styles.label}>Max $</Text>
              <TextInput
                style={styles.input}
                value={draft.amountMax}
                onChangeText={(text) => setDraft((d) => ({ ...d, amountMax: text }))}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
            <Text style={styles.clearButtonText}>Clear all filters</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <SelectModal
        visible={showCategoryPicker}
        title="Category"
        sections={categorySections}
        selectedValue={draft.categoryId ?? ""}
        onSelect={(value) => setDraft((d) => ({ ...d, categoryId: value || null }))}
        onClose={() => setShowCategoryPicker(false)}
      />
      <SelectModal
        visible={showAccountPicker}
        title="Account"
        sections={accountSections}
        selectedValue={draft.accountId ?? ""}
        onSelect={(value) => setDraft((d) => ({ ...d, accountId: value || null }))}
        onClose={() => setShowAccountPicker(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
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
  input: {
    backgroundColor: colors.surfaceHover,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  rowField: {
    flex: 1,
  },
  clearButton: {
    marginTop: 24,
    alignItems: "center",
    paddingVertical: 12,
  },
  clearButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  applyButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  applyButtonText: {
    color: colors.onAccent,
    fontWeight: "700",
    fontSize: 15,
  },
});
