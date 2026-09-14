import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TransactionsListScreen from "../screens/TransactionsListScreen";
import NewExpenseScreen from "../screens/NewExpenseScreen";
import EditTransactionScreen from "../screens/EditTransactionScreen";
import TransactionHistoryScreen from "../screens/TransactionHistoryScreen";
import { colors } from "../lib/theme";

export type TransactionsStackParamList = {
  TransactionsList: undefined;
  NewExpense: undefined;
  EditTransaction: { id: string };
  TransactionHistory: { id: string };
};

const Stack = createNativeStackNavigator<TransactionsStackParamList>();

export function TransactionsStackScreen() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="TransactionsList"
        component={TransactionsListScreen}
        options={{ title: "Transactions" }}
      />
      <Stack.Screen
        name="NewExpense"
        component={NewExpenseScreen}
        options={{ title: "New Expense", presentation: "modal" }}
      />
      <Stack.Screen
        name="EditTransaction"
        component={EditTransactionScreen}
        options={{ title: "Transaction" }}
      />
      <Stack.Screen
        name="TransactionHistory"
        component={TransactionHistoryScreen}
        options={{ title: "History" }}
      />
    </Stack.Navigator>
  );
}
