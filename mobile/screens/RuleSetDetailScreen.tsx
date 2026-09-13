import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Card } from "../components/Card";
import { RuleSetBreakdown } from "../components/RuleSetBreakdown";
import { colors, toneBadgeBg, toneText } from "../lib/theme";
import type { BudgetStackParamList } from "../navigation/BudgetStack";

type Props = NativeStackScreenProps<BudgetStackParamList, "RuleDetail">;

// Doesn't re-fetch, same as GoalDetailScreen: GET /api/rules already
// returns every rule set's full row list, so the list screen's entry is
// already everything a single-rule-set fetch would provide.
export default function RuleSetDetailScreen({ route, navigation }: Props) {
  const { ruleSet } = route.params;

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.badge}>
            <Ionicons name="pie-chart" size={22} color={toneText.accent} />
          </View>
          <Text style={styles.name}>{ruleSet.name}</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate("EditRuleSet", { ruleSet })}
          >
            <Ionicons name="pencil" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Card>
          <RuleSetBreakdown rows={ruleSet.rows} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: toneBadgeBg.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
