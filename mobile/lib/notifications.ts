import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { currency } from "./format";
import type { ScheduledTransactionRow } from "./api";

// Phase 9 -- local-only notifications. There is no backend push
// infrastructure (no APNs/FCM server-side setup, no push token storage on
// the API), so every notification here is a device-local scheduled/
// immediate notification built from data the app already fetched -- the
// server never pushes anything to the device.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const ENABLED_KEY = "ledger.notifications.enabled";
const PERMISSION_REQUESTED_KEY = "ledger.notifications.permissionRequested";
const SCHEDULED_IDS_KEY = "ledger.notifications.scheduledIds";
const LAST_SUBSCRIPTION_COUNT_KEY = "ledger.notifications.lastSubscriptionCount";
const ANDROID_CHANNEL_ID = "default";

export type NotificationKind = "scheduled" | "subscriptions";

// Same on/off preference pattern as mobile/lib/appLock.ts: a plain
// non-sensitive toggle, AsyncStorage, default on.
export async function loadNotificationsEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(ENABLED_KEY);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

export async function saveNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, enabled ? "true" : "false");
}

async function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Ledger",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

// Requests OS permission exactly once per install, the first time the app
// gets past the Face ID gate and a connection is established (see
// NotificationsContext.tsx) -- never re-prompts after a denial, same as
// any other iOS/Android permission; the user would need their device
// Settings for that.
export async function ensurePermissionRequestedOnce(): Promise<void> {
  const already = await AsyncStorage.getItem(PERMISSION_REQUESTED_KEY);
  if (already) return;
  await AsyncStorage.setItem(PERMISSION_REQUESTED_KEY, "true");
  await configureAndroidChannel();
  await Notifications.requestPermissionsAsync();
}

function trackingKey(item: ScheduledTransactionRow): string {
  return `${item.id}::${item.nextDueDate}`;
}

async function loadTracked(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULED_IDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveTracked(tracked: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(SCHEDULED_IDS_KEY, JSON.stringify(tracked));
}

// Schedules one local reminder per due-within-24h scheduled transaction
// that doesn't already have one pending, tracked by "id::nextDueDate" (not
// just id) in AsyncStorage so: (a) re-fetching the Scheduled screen --
// pull-to-refresh, refocus -- never double-schedules the same due date,
// and (b) once a cycle is confirmed or skipped its nextDueDate moves on,
// which naturally produces a fresh tracking key and a fresh notification
// next time that new date is within the window, rather than the item
// being silently skipped forever because its stable `id` was already used.
export async function syncScheduledNotifications(
  dueAndUpcoming: ScheduledTransactionRow[],
  enabled: boolean
): Promise<void> {
  const tracked = await loadTracked();
  const currentKeys = new Set(dueAndUpcoming.map(trackingKey));
  let changed = false;

  // Drop (and cancel) tracking for any cycle that's no longer current --
  // confirmed, skipped, or deactivated since the last fetch -- so a stale
  // reminder for an already-handled item doesn't fire, and this map
  // doesn't grow forever.
  for (const key of Object.keys(tracked)) {
    if (!currentKeys.has(key)) {
      await Notifications.cancelScheduledNotificationAsync(tracked[key]).catch(() => {});
      delete tracked[key];
      changed = true;
    }
  }

  if (enabled) {
    await configureAndroidChannel();
    const now = new Date();
    const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    for (const item of dueAndUpcoming) {
      const key = trackingKey(item);
      if (tracked[key]) continue;

      // nextDueDate is a plain YYYY-MM-DD (see mobile/lib/dates.ts's
      // comment on avoiding UTC parsing) -- 9am local on that date is the
      // reminder time; anything already due (today or earlier, from the
      // "due" bucket) fires almost immediately instead.
      const dueAt = new Date(`${item.nextDueDate}T09:00:00`);
      if (dueAt > cutoff) continue;

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Scheduled transaction due",
          body: `${item.description} -- ${currency(item.amount)}, due ${item.nextDueDate}`,
          data: { kind: "scheduled" as NotificationKind },
        },
        trigger:
          dueAt.getTime() <= now.getTime()
            ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, repeats: false }
            : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dueAt },
      });
      tracked[key] = notificationId;
      changed = true;
    }
  }

  if (changed) await saveTracked(tracked);
}

// Cancels every notification syncScheduledNotifications has scheduled and
// forgets them -- called when the user flips the Settings toggle off, so
// disabling notifications also silences ones already queued, not just
// future scheduling.
export async function cancelAllTrackedScheduledNotifications(): Promise<void> {
  const tracked = await loadTracked();
  await Promise.all(
    Object.values(tracked).map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
  );
  await AsyncStorage.removeItem(SCHEDULED_IDS_KEY);
}

// Fires once per increase in the dashboard's newSubscriptionCount --
// "since last check" means since the last time this ran (effectively
// every Dashboard fetch), not a fixed calendar period. The very first
// check after install only records a baseline and never fires, even if
// the count is already nonzero, since nothing "new" happened relative to
// a check that never occurred before.
export async function notifyIfNewSubscriptionsDetected(count: number, enabled: boolean): Promise<void> {
  const raw = await AsyncStorage.getItem(LAST_SUBSCRIPTION_COUNT_KEY);
  const last = raw !== null ? Number(raw) : null;
  await AsyncStorage.setItem(LAST_SUBSCRIPTION_COUNT_KEY, String(count));

  if (!enabled || last === null || count <= last) return;

  await configureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "New subscription detected",
      body: `${count} subscription${count === 1 ? "" : "s"} found in your transaction history.`,
      data: { kind: "subscriptions" as NotificationKind },
    },
    trigger: null,
  });
}
