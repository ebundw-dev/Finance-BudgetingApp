import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BudgetMenuScreen from "../screens/BudgetMenuScreen";
import AllocateScreen from "../screens/AllocateScreen";
import GoalsListScreen from "../screens/GoalsListScreen";
import GoalDetailScreen from "../screens/GoalDetailScreen";
import NewGoalScreen from "../screens/NewGoalScreen";
import EditGoalScreen from "../screens/EditGoalScreen";
import DebtsListScreen from "../screens/DebtsListScreen";
import DebtDetailScreen from "../screens/DebtDetailScreen";
import EditDebtScreen from "../screens/EditDebtScreen";
import NewAccountScreen from "../screens/NewAccountScreen";
import RuleSetsListScreen from "../screens/RuleSetsListScreen";
import RuleSetDetailScreen from "../screens/RuleSetDetailScreen";
import NewRuleSetScreen from "../screens/NewRuleSetScreen";
import EditRuleSetScreen from "../screens/EditRuleSetScreen";
import ScheduledScreen from "../screens/ScheduledScreen";
import { colors } from "../lib/theme";
import type { DebtRow, GoalListRow, RuleSet } from "../lib/api";

export type BudgetStackParamList = {
  BudgetMenu: undefined;
  Allocate: undefined;
  Goals: undefined;
  GoalDetail: { goal: GoalListRow };
  NewGoal: undefined;
  EditGoal: { goal: GoalListRow };
  Debts: undefined;
  DebtDetail: { id: string; name: string };
  EditDebt: { debt: DebtRow };
  NewAccount: { initialIsDebt?: boolean } | undefined;
  Rules: undefined;
  RuleDetail: { ruleSet: RuleSet };
  NewRuleSet: undefined;
  EditRuleSet: { ruleSet: RuleSet };
  Scheduled: undefined;
};

const Stack = createNativeStackNavigator<BudgetStackParamList>();

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
      <Stack.Screen name="NewGoal" component={NewGoalScreen} options={{ title: "New Goal", presentation: "modal" }} />
      <Stack.Screen name="EditGoal" component={EditGoalScreen} options={{ title: "Edit Goal" }} />
      <Stack.Screen name="Debts" component={DebtsListScreen} options={{ title: "Debts" }} />
      <Stack.Screen
        name="DebtDetail"
        component={DebtDetailScreen}
        options={({ route }) => ({ title: route.params.name })}
      />
      <Stack.Screen name="EditDebt" component={EditDebtScreen} options={{ title: "Edit Debt" }} />
      <Stack.Screen
        name="NewAccount"
        component={NewAccountScreen}
        options={{ title: "New Account", presentation: "modal" }}
      />
      <Stack.Screen name="Rules" component={RuleSetsListScreen} options={{ title: "Rule Sets" }} />
      <Stack.Screen
        name="RuleDetail"
        component={RuleSetDetailScreen}
        options={({ route }) => ({ title: route.params.ruleSet.name })}
      />
      <Stack.Screen
        name="NewRuleSet"
        component={NewRuleSetScreen}
        options={{ title: "New Rule Set", presentation: "modal" }}
      />
      <Stack.Screen
        name="EditRuleSet"
        component={EditRuleSetScreen}
        options={({ route }) => ({ title: route.params.ruleSet.name })}
      />
      <Stack.Screen name="Scheduled" component={ScheduledScreen} options={{ title: "Scheduled" }} />
    </Stack.Navigator>
  );
}
