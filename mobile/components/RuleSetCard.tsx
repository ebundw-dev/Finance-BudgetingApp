import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "./Card";
import { RuleSetBreakdown } from "./RuleSetBreakdown";
import { colors, toneBadgeBg, toneText } from "../lib/theme";
import type { RuleSet } from "../lib/api";

export function RuleSetCard({ ruleSet, onPress }: { ruleSet: RuleSet; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card>
        <View style={styles.headerRow}>
          <View style={styles.badge}>
            <Ionicons name="pie-chart" size={18} color={toneText.accent} />
          </View>
          <Text style={styles.name}>{ruleSet.name}</Text>
        </View>
        <RuleSetBreakdown rows={ruleSet.rows} />
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: toneBadgeBg.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
});
