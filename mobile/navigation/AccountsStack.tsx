import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AccountsListScreen from "../screens/AccountsListScreen";
import AccountDetailScreen from "../screens/AccountDetailScreen";
import NewAccountScreen from "../screens/NewAccountScreen";
import EditAccountScreen from "../screens/EditAccountScreen";
import { colors } from "../lib/theme";
import type { Account } from "../lib/api";

export type AccountsStackParamList = {
  AccountsList: undefined;
  AccountDetail: { id: string; name: string };
  NewAccount: undefined;
  EditAccount: { account: Account };
};

const Stack = createNativeStackNavigator<AccountsStackParamList>();

export function AccountsStackScreen() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="AccountsList" component={AccountsListScreen} options={{ title: "Accounts" }} />
      <Stack.Screen
        name="AccountDetail"
        component={AccountDetailScreen}
        options={({ route }) => ({ title: route.params.name })}
      />
      <Stack.Screen
        name="NewAccount"
        component={NewAccountScreen}
        options={{ title: "New Account", presentation: "modal" }}
      />
      <Stack.Screen name="EditAccount" component={EditAccountScreen} options={{ title: "Edit Account" }} />
    </Stack.Navigator>
  );
}
