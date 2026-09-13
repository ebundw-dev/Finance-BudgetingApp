import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DarkTheme, type Theme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "./lib/theme";
import DashboardScreen from "./screens/DashboardScreen";
import { PlaceholderScreen } from "./screens/PlaceholderScreen";

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

function AccountsScreen() {
  return <PlaceholderScreen title="Accounts" icon="wallet-outline" />;
}
function TransactionsScreen() {
  return <PlaceholderScreen title="Transactions" icon="swap-horizontal-outline" />;
}
function SettingsScreen() {
  return <PlaceholderScreen title="Settings" icon="settings-outline" />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
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
            component={AccountsScreen}
            options={{ tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} /> }}
          />
          <Tab.Screen
            name="Transactions"
            component={TransactionsScreen}
            options={{ tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal" size={size} color={color} /> }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} /> }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
