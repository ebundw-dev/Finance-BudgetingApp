import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Card } from "./Card";
import { TransactionTypeBadge } from "./TransactionTypeBadge";
import { colors } from "../lib/theme";
import { CADENCE_LABELS } from "../lib/cadence";
import { ApiError, confirmScheduled, skipScheduled, type ScheduledTransactionRow } from "../lib/api";
import { useConnection } from "../lib/ConnectionContext";

// Mirrors src/components/ConfirmScheduledForm.tsx: an inline editable
// amount next to Confirm/Skip, not a separate edit page -- the amount can
// be overridden at confirm time via POST .../confirm's optional `amount`.
export function ScheduledDueRow({
  item,
  onDone,
}: {
  item: ScheduledTransactionRow;
  onDone: () => void;
}) {
  const { connection } = useConnection();
  const [amount, setAmount] = useState(item.amount);
  const [busy, setBusy] = useState<"confirm" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy("confirm");
    setError(null);
    try {
      const trimmed = amount.trim();
      await confirmScheduled(connection.baseUrl, connection.token, item.id, trimmed !== item.amount ? trimmed : undefined);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function handleSkip() {
    setBusy("skip");
    setError(null);
    try {
      await skipScheduled(connection.baseUrl, connection.token, item.id);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.description} numberOfLines={1}>
          {item.description}
        </Text>
        <TransactionTypeBadge type={item.type} />
      </View>
      <Text style={styles.caption}>
        Due {item.nextDueDate} — {CADENCE_LABELS[item.cadence] ?? item.cadence}
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.actionsRow}>
        <TextInput
          style={styles.amountInput}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          editable={busy === null}
        />
        <TouchableOpacity
          style={[styles.confirmButton, busy !== null && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={busy !== null}
        >
          {busy === "confirm" ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <Text style={styles.confirmButtonText}>Confirm</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.skipButton, busy !== null && styles.buttonDisabled]}
          onPress={handleSkip}
          disabled={busy !== null}
        >
          {busy === "skip" ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Text style={styles.skipButtonText}>Skip</Text>
          )}
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: `${colors.danger}4d`,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  description: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  caption: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 8,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  amountInput: {
    width: 84,
    backgroundColor: colors.surfaceHover,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    textAlign: "right",
  },
  confirmButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  confirmButtonText: {
    color: colors.onAccent,
    fontWeight: "700",
    fontSize: 13,
  },
  skipButton: {
    flex: 1,
    backgroundColor: colors.surfaceHover,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  skipButtonText: {
    color: colors.textSecondary,
    fontWeight: "600",
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
