import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BudgetMenuScreen from "../screens/BudgetMenuScreen";
import AllocateScreen from "../screens/AllocateScreen";
import { PlaceholderScreen } from "../screens/PlaceholderScreen";
import { colors } from "../lib/theme";
import type { GoalListRow, RuleSet } from "../lib/api";

export type BudgetStackParamList = {
  BudgetMenu: undefined;
  Allocate: undefined;
  Goals: undefined;
  GoalDetail: { goal: GoalListRow };
  Debts: undefined;
  DebtDetail: { id: string; name: string };
  Rules: undefined;
  RuleDetail: { ruleSet: RuleSet };
  Scheduled: undefined;
};

const Stack = createNativeStackNavigator<BudgetStackParamList>();

// Screens not yet built this phase -- swapped for the real thing one
// commit at a time, same as every other screen in this stack.
function GoalsPlaceholder() {
  return <PlaceholderScreen title="Goals" icon="flag-outline" />;
}
function DebtsPlaceholder() {
  return <PlaceholderScreen title="Debts" icon="card-outline" />;
}
function RulesPlaceholder() {
  return <PlaceholderScreen title="Rule Sets" icon="pie-chart-outline" />;
}
function ScheduledPlaceholder() {
  return <PlaceholderScreen title="Scheduled" icon="repeat-outline" />;
}

export function BudgetStackScreen() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="BudgetMenu" component={BudgetMenuScreen} options={{ title: "Budget" }} />
      <Stack.Screen name="Allocate" component={AllocateScreen} options={{ title: "Allocate" }} />
      <Stack.Screen name="Goals" component={GoalsPlaceholder} options={{ title: "Goals" }} />
      <Stack.Screen name="Debts" component={DebtsPlaceholder} options={{ title: "Debts" }} />
      <Stack.Screen name="Rules" component={RulesPlaceholder} options={{ title: "Rule Sets" }} />
      <Stack.Screen name="Scheduled" component={ScheduledPlaceholder} options={{ title: "Scheduled" }} />
    </Stack.Navigator>
  );
}
