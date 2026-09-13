import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme, type Theme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "./lib/theme";
import { ConnectionProvider } from "./lib/ConnectionContext";
import DashboardScreen from "./screens/DashboardScreen";
import SettingsScreen from "./screens/SettingsScreen";
import { AccountsStackScreen } from "./navigation/AccountsStack";
import { TransactionsStackScreen } from "./navigation/TransactionsStack";
import { BudgetStackScreen } from "./navigation/BudgetStack";

const Tab = createBottomTabNavigator();

const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.base,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ConnectionProvider>
        <NavigationContainer theme={navigationTheme}>
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
              tabBarActiveTintColor: colors.accent,
              tabBarInactiveTintColor: colors.textMuted,
            }}
          >
            <Tab.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{ tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }}
            />
            <Tab.Screen
              name="Accounts"
              component={AccountsStackScreen}
              options={{ tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} /> }}
            />
            <Tab.Screen
              name="Transactions"
              component={TransactionsStackScreen}
              options={{ tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal" size={size} color={color} /> }}
            />
            <Tab.Screen
              name="Budget"
              component={BudgetStackScreen}
              options={{ tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }}
            />
            <Tab.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} /> }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </ConnectionProvider>
    </SafeAreaProvider>
  );
}
