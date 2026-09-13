import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../components/Card";
import { ScreenHeader } from "../components/ScreenHeader";
import { colors } from "../lib/theme";
import { useConnection } from "../lib/ConnectionContext";
import { useAppLock } from "../lib/AppLockContext";

// Masks the middle of the token, showing just enough of each end that
// the user can visually match it against the name they gave it in the
// web app's Settings token list, without ever showing the whole thing.
function maskToken(token: string): string {
  if (token.length <= 10) return "•".repeat(token.length);
  return `${token.slice(0, 6)}${"•".repeat(10)}${token.slice(-4)}`;
}

export default function SettingsScreen() {
  const { connection, disconnect } = useConnection();
  const { enabled: appLockEnabled, setEnabled: setAppLockEnabled } = useAppLock();

  function confirmDisconnect() {
    Alert.alert(
      "Disconnect this device?",
      "You'll need to re-enter the API Base URL and token to reconnect. This doesn't revoke the token itself -- do that from the web app if the phone is lost.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Disconnect", style: "destructive", onPress: () => disconnect() },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader eyebrow="Devices with access" title="Settings" />

        <Card style={styles.section}>
          <Text style={styles.sectionHeading}>Connected Account</Text>
          <Row label="API Base URL" value={connection.baseUrl} />
          <Row label="API Token" value={maskToken(connection.token)} last />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionHeading}>Security</Text>
          <View style={styles.lockRow}>
            <View style={styles.lockText}>
              <Text style={styles.lockLabel}>Require Face ID / Touch ID</Text>
              <Text style={styles.lockCaption}>
                Locks the app on launch and after it’s been backgrounded a minute or more.
              </Text>
            </View>
            <Switch
              value={appLockEnabled}
              onValueChange={setAppLockEnabled}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surface}
            />
          </View>
        </Card>

        <TouchableOpacity style={styles.disconnectButton} onPress={confirmDisconnect}>
          <Ionicons name="log-out-outline" size={17} color={colors.danger} />
          <Text style={styles.disconnectButtonText}>Disconnect</Text>
        </TouchableOpacity>

        <Card style={styles.infoCard}>
          <View style={styles.infoHeaderRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.warning} />
            <Text style={styles.infoHeading}>Lost this phone?</Text>
          </View>
          <Text style={styles.infoBody}>
            This app can’t revoke its own token -- that only happens from the web app. Open the web
            app on another device, go to Settings, find the token you named for this phone in the
            list, and tap Revoke. It stops working on its very next request; you’d need to create and
            enter a new token here to reconnect.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.base,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  section: {
    paddingVertical: 4,
  },
  sectionHeading: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  rowValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
  lockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    gap: 12,
  },
  lockText: {
    flex: 1,
    minWidth: 0,
  },
  lockLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  lockCaption: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  disconnectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: `${colors.danger}4d`,
    backgroundColor: `${colors.danger}14`,
    borderRadius: 10,
    paddingVertical: 13,
  },
  disconnectButtonText: {
    color: colors.danger,
    fontWeight: "700",
    fontSize: 14,
  },
  infoCard: {
    borderColor: `${colors.warning}4d`,
    backgroundColor: `${colors.warning}0d`,
  },
  infoHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  infoHeading: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  infoBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
});
