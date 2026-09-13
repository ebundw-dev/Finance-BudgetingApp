import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as Notifications from "expo-notifications";
import {
  cancelAllTrackedScheduledNotifications,
  ensurePermissionRequestedOnce,
  loadNotificationsEnabled,
  saveNotificationsEnabled,
  type NotificationKind,
} from "./notifications";
import { navigateToScheduled, navigateToSubscriptionsAlert } from "./navigationRef";

interface NotificationsContextValue {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}

function handleTap(data: unknown): void {
  const kind = (data as { kind?: NotificationKind } | null | undefined)?.kind;
  if (kind === "scheduled") navigateToScheduled();
  else if (kind === "subscriptions") navigateToSubscriptionsAlert();
}

// Mounted once past both the Face ID gate and the connect screen (see
// App.tsx -- it wraps the tab navigator, inside ConnectionProvider's
// children) so the OS permission prompt never stacks on top of either of
// those. Owns the enabled/disabled preference for the Settings toggle,
// same enabled/setEnabled shape as AppLockContext.
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pref = await loadNotificationsEnabled();
      if (cancelled) return;
      setEnabledState(pref);
      if (pref) await ensurePermissionRequestedOnce();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Cold start: the OS launched the app because the user tapped a
    // notification while it wasn't running.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleTap(response.notification.request.content.data);
    });

    // Warm/background: the app was already running (or just backgrounded)
    // when the notification was tapped.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleTap(response.notification.request.content.data);
    });
    return () => subscription.remove();
  }, []);

  function setEnabled(value: boolean) {
    setEnabledState(value);
    saveNotificationsEnabled(value).catch(() => {});
    if (value) {
      ensurePermissionRequestedOnce().catch(() => {});
    } else {
      // Turning the in-app toggle off also silences anything already
      // queued, not just future scheduling.
      cancelAllTrackedScheduledNotifications().catch(() => {});
    }
  }

  return <NotificationsContext.Provider value={{ enabled, setEnabled }}>{children}</NotificationsContext.Provider>;
}
