import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Card } from "./Card";
import { colors, toneBadgeBg, toneText } from "../lib/theme";
import { currency } from "../lib/format";
import type { SubscriptionCandidate } from "../lib/api";

const CADENCE_LABELS: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

// Mirrors the web Subscriptions page's card
// (src/app/(app)/subscriptions/page.tsx): payee + account/category
// subtitle, a cadence pill, the average amount, occurrence count + next
// predicted date, and Track it / Dismiss actions.
export function SubscriptionCard({
  candidate,
  onTrack,
  onDismiss,
  busy,
}: {
  candidate: SubscriptionCandidate;
  onTrack: () => void;
  onDismiss: () => void;
  busy: "track" | "dismiss" | null;
}) {
  const disabled = busy !== null;

  return (
    <Card>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.payee} numberOfLines={1}>
            {candidate.payee}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {candidate.accountName} · {candidate.categoryName}
          </Text>
        </View>
        <View style={[styles.pill, { backgroundColor: toneBadgeBg.accent }]}>
          <Text style={[styles.pillText, { color: toneText.accent }]}>
            {CADENCE_LABELS[candidate.cadence] ?? candidate.cadence}
          </Text>
        </View>
      </View>

      <Text style={styles.amount}>{currency(candidate.averageAmount)}</Text>
      <Text style={styles.meta}>
        {candidate.occurrenceCount} charges detected · next predicted {candidate.nextPredictedDate}
      </Text>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.trackButton, disabled && styles.buttonDisabled]} onPress={onTrack} disabled={disabled}>
          {busy === "track" ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <Text style={styles.trackButtonText}>Track it</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dismissButton, disabled && styles.buttonDisabled]}
          onPress={onDismiss}
          disabled={disabled}
        >
          {busy === "dismiss" ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Text style={styles.dismissButtonText}>Dismiss</Text>
          )}
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  payee: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  amount: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 14,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  trackButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  trackButtonText: {
    color: colors.onAccent,
    fontWeight: "700",
    fontSize: 13,
  },
  dismissButton: {
    flex: 1,
    backgroundColor: colors.surfaceHover,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  dismissButtonText: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
