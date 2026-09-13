import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors } from "../lib/theme";
import type { TargetType } from "../lib/categoryTargets";

const TARGET_TYPES: { value: TargetType | ""; label: string }[] = [
  { value: "", label: "None" },
  { value: "refill_up_to", label: "Refill Up To" },
  { value: "set_aside_monthly", label: "Set Aside Monthly" },
  { value: "by_date", label: "By Date" },
];

export interface CategoryTargetValue {
  targetType: TargetType | "";
  targetAmount: string;
  targetCadence: "weekly" | "monthly" | "";
  targetDate: string;
}

// Ports src/components/CategoryTargetFields.tsx's 4-way selector (a radio
// pill row on web) to React Native, and the same conditional
// amount/cadence/date fields per type. Controlled from the parent (New/
// EditCategoryScreen) rather than owning its own state, since both
// screens need the current value to build their submit payload.
export function CategoryTargetFields({
  value,
  onChange,
}: {
  value: CategoryTargetValue;
  onChange: (value: CategoryTargetValue) => void;
}) {
  const { targetType, targetAmount, targetCadence, targetDate } = value;

  return (
    <View>
      <Text style={styles.label}>Target</Text>
      <View style={styles.pillRow}>
        {TARGET_TYPES.map((t) => {
          const selected = targetType === t.value;
          return (
            <TouchableOpacity
              key={t.value || "none"}
              style={[styles.pill, selected && styles.pillSelected]}
              onPress={() => onChange({ ...value, targetType: t.value })}
            >
              <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {targetType !== "" ? (
        <View style={styles.field}>
          <Text style={styles.label}>{targetType === "by_date" ? "Total amount needed" : "Target amount"}</Text>
          <TextInput
            style={styles.input}
            value={targetAmount}
            onChangeText={(text) => onChange({ ...value, targetAmount: text })}
            keyboardType="decimal-pad"
          />
        </View>
      ) : null}

      {targetType === "refill_up_to" ? (
        <View style={styles.field}>
          <Text style={styles.label}>Refill cadence (optional -- for display only)</Text>
          <View style={styles.pillRow}>
            {(["", "weekly", "monthly"] as const).map((cadence) => {
              const selected = targetCadence === cadence;
              return (
                <TouchableOpacity
                  key={cadence || "none"}
                  style={[styles.pill, selected && styles.pillSelected]}
                  onPress={() => onChange({ ...value, targetCadence: cadence })}
                >
                  <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                    {cadence === "" ? "—" : cadence === "weekly" ? "Weekly" : "Monthly"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {targetType === "set_aside_monthly" ? (
        <Text style={styles.hint}>
          This amount is expected every calendar month, regardless of leftover balance -- there&apos;s
          no cap.
        </Text>
      ) : null}

      {targetType === "by_date" ? (
        <View style={styles.field}>
          <Text style={styles.label}>Target date</Text>
          <TextInput
            style={styles.input}
            value={targetDate}
            onChangeText={(text) => onChange({ ...value, targetDate: text })}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.hint}>
            The monthly amount needed is calculated from today&apos;s date, the amount already saved,
            and this deadline.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
    marginTop: 16,
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
    paddingHorizontal: 12,
    paddingVertical: 7,
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
  field: {
    marginTop: 0,
  },
  input: {
    backgroundColor: colors.surfaceHover,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 6,
  },
});
