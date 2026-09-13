import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BudgetMenuScreen from "../screens/BudgetMenuScreen";
import AllocateScreen from "../screens/AllocateScreen";
import GoalsListScreen from "../screens/GoalsListScreen";
import GoalDetailScreen from "../screens/GoalDetailScreen";
import DebtsListScreen from "../screens/DebtsListScreen";
import DebtDetailScreen from "../screens/DebtDetailScreen";
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
      <Stack.Screen name="Goals" component={GoalsListScreen} options={{ title: "Goals" }} />
      <Stack.Screen
        name="GoalDetail"
        component={GoalDetailScreen}
        options={({ route }) => ({ title: route.params.goal.name })}
      />
      <Stack.Screen name="Debts" component={DebtsListScreen} options={{ title: "Debts" }} />
      <Stack.Screen
        name="DebtDetail"
        component={DebtDetailScreen}
        options={({ route }) => ({ title: route.params.name })}
      />
      <Stack.Screen name="Rules" component={RulesPlaceholder} options={{ title: "Rule Sets" }} />
      <Stack.Screen name="Scheduled" component={ScheduledPlaceholder} options={{ title: "Scheduled" }} />
    </Stack.Navigator>
  );
}
