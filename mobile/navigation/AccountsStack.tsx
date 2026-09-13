import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AccountsListScreen from "../screens/AccountsListScreen";
import AccountDetailScreen from "../screens/AccountDetailScreen";
import { colors } from "../lib/theme";

export type AccountsStackParamList = {
  AccountsList: undefined;
  AccountDetail: { id: string; name: string };
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
    </Stack.Navigator>
  );
}
