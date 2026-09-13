import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Card } from "../components/Card";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors, toneBadgeBg, toneText, type Tone } from "../lib/theme";
import type { BudgetStackParamList } from "../navigation/BudgetStack";

type Props = NativeStackScreenProps<BudgetStackParamList, "BudgetMenu">;

type IconName = ComponentProps<typeof Ionicons>["name"];

// A single "Budget" tab folds Allocate/Goals/Debts/Rule Sets/Scheduled in
// as stack screens reached from this menu, rather than five more bottom
// tabs -- past ~5 tabs a phone-width bar starts clipping labels.
const ITEMS: { route: keyof BudgetStackParamList; label: string; subtitle: string; icon: IconName; tone: Tone }[] = [
  { route: "Allocate", label: "Allocate", subtitle: "Assign unallocated cash to categories", icon: "options", tone: "accent" },
  { route: "Goals", label: "Goals", subtitle: "Progress toward savings targets", icon: "flag", tone: "success" },
  { route: "Debts", label: "Debts", subtitle: "Balances, APR, and payoff targets", icon: "card", tone: "danger" },
  { route: "Rules", label: "Rule Sets", subtitle: "Percentage splits for Auto-Allocate", icon: "pie-chart", tone: "info" },
  { route: "Scheduled", label: "Scheduled", subtitle: "Due and upcoming recurring items", icon: "repeat", tone: "warning" },
];

export default function BudgetMenuScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader eyebrow="Budget" title="Manage your money" />
        <View style={styles.list}>
          {ITEMS.map((item) => (
            <TouchableOpacity key={item.route} onPress={() => navigation.navigate(item.route as never)} activeOpacity={0.7}>
              <Card style={styles.row}>
                <View style={[styles.badge, { backgroundColor: toneBadgeBg[item.tone] }]}>
                  <Ionicons name={item.icon} size={19} color={toneText[item.tone]} />
                </View>
                <View style={styles.body}>
                  <Text style={styles.label}>{item.label}</Text>
                  <Text style={styles.subtitle}>{item.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Card>
            </TouchableOpacity>
          ))}
        </View>
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
  list: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
});
