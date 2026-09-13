import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../lib/theme";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface SelectSection {
  title: string;
  options: SelectOption[];
}

// A simple full-screen list picker -- there's no native <select> in React
// Native. Used for the account and category pickers on the create-expense
// form. Deliberately plain (no search, no multi-select): this phase's
// form is meant to stay simple.
export function SelectModal({
  visible,
  title,
  sections,
  selectedValue,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  sections: SelectSection[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.options.map((option) => {
                const selected = option.value === selectedValue;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={styles.option}
                    onPress={() => {
                      onSelect(option.value);
                      onClose();
                    }}
                  >
                    <View style={styles.optionText}>
                      <Text style={styles.optionLabel}>{option.label}</Text>
                      {option.sublabel ? <Text style={styles.optionSublabel}>{option.sublabel}</Text> : null}
                    </View>
                    {selected ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          {sections.every((s) => s.options.length === 0) ? (
            <Text style={styles.emptyText}>Nothing to choose from yet.</Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
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
  list: {
    padding: 16,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
  },
  optionText: {
    flex: 1,
    minWidth: 0,
  },
  optionLabel: {
    color: colors.text,
    fontSize: 14,
  },
  optionSublabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
  },
});
