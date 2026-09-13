import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { Tone } from "./theme";
import type { AccountType } from "./api";

type IconName = ComponentProps<typeof Ionicons>["name"];

// Native re-creation of the account-type -> label/icon/tone mapping
// shared by src/app/(app)/accounts/page.tsx and src/app/(app)/debts/page.tsx
// (identical on web, lucide-react icons). Mobile uses Ionicons instead of
// lucide-react-native, so the icon choices are new equivalents, not a
// direct import; the labels and tones are kept identical to web.
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  cash: "Cash",
  credit_card: "Credit Card",
  investment: "Investment",
  other: "Other",
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, IconName> = {
  checking: "business",
  savings: "wallet",
  cash: "cash",
  credit_card: "card",
  investment: "trending-up",
  other: "ellipsis-horizontal-circle-outline",
};

export const ACCOUNT_TYPE_TONE: Record<AccountType, Tone> = {
  checking: "accent",
  savings: "success",
  cash: "success",
  credit_card: "danger",
  investment: "info",
  other: "default",
};
