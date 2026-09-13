import { StyleSheet, Text, View } from "react-native";
import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "./Card";
import { colors, toneBadgeBg, toneText, type Tone } from "../lib/theme";

// Mirrors src/components/Card.tsx's StatCard: label + tinted icon badge +
// large tabular-nums value.
export function StatCard({
  label,
  value,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  tone?: Tone;
  icon: ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <View style={[styles.badge, { backgroundColor: toneBadgeBg[tone] }]}>
          <Ionicons name={icon} size={16} color={toneText[tone]} />
        </View>
      </View>
      <Text style={[styles.value, { color: toneText[tone] }]}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: "45%",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: "700",
  },
});
