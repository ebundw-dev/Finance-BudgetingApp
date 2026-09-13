import { createNavigationContainerRef, type NavigatorScreenParams } from "@react-navigation/native";
import type { AccountsStackParamList } from "../navigation/AccountsStack";
import type { TransactionsStackParamList } from "../navigation/TransactionsStack";
import type { BudgetStackParamList } from "../navigation/BudgetStack";

// The root Tab.Navigator's own param list (App.tsx) -- typed here rather
// than in App.tsx so a standalone module (notification tap handling,
// which can't reach the Tab.Navigator's props) can navigate through a
// ref instead of a hook, same as React Navigation's own docs recommend
// for navigating from outside a component.
export type RootTabParamList = {
  Dashboard: undefined;
  Accounts: NavigatorScreenParams<AccountsStackParamList>;
  Transactions: NavigatorScreenParams<TransactionsStackParamList>;
  Budget: NavigatorScreenParams<BudgetStackParamList>;
  Settings: undefined;
};

export const navigationRef = createNavigationContainerRef<RootTabParamList>();

// A notification tap can arrive before NavigationContainer has finished
// its first render -- most plausibly a cold start where the OS launches
// the app straight from a tapped notification -- so this retries briefly
// instead of silently dropping the navigation.
function navigateWhenReady(fn: () => void, attemptsLeft = 20): void {
  if (navigationRef.isReady()) {
    fn();
    return;
  }
  if (attemptsLeft <= 0) return;
  setTimeout(() => navigateWhenReady(fn, attemptsLeft - 1), 150);
}

export function navigateToScheduled(): void {
  navigateWhenReady(() => navigationRef.navigate("Budget", { screen: "Scheduled" }));
}

// Phase 10 added a real Subscriptions screen (Budget > Subscriptions) --
// this used to fall back to Dashboard (the only place the
// newSubscriptionCount alert lived before that screen existed).
export function navigateToSubscriptionsAlert(): void {
  navigateWhenReady(() => navigationRef.navigate("Budget", { screen: "Subscriptions" }));
}
