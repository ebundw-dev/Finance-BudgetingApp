import type { ExpoConfig } from "expo/config";

// Dark sidebar palette from the web app's globals.css (.sidebar-dark
// block) -- reused here purely for icon/splash placeholder color, not
// because the mobile app shares any code with the web app.
const DARK_BASE = "#0f211d";

const config: ExpoConfig = {
  name: "Ledger",
  slug: "ledger-mobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  scheme: "ledger",
  ios: {
    // Change this if EAS reports the bundle identifier is already
    // registered to a different Apple Developer account -- it only needs
    // to be unique across Apple's ecosystem, not meaningful in any other
    // way. See mobile/README.md.
    bundleIdentifier: "com.ebundw.ledgermobile",
    supportsTablet: true,
    infoPlist: {
      // Phase 2 only ever talks to a local dev server (LAN IP or an
      // ngrok/tunnel URL), never a production API -- ATS normally blocks
      // plain HTTP entirely. This is a development-only relaxation; a
      // later phase pointing at a real deployed (HTTPS) API should
      // remove it rather than carry it into a release build.
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
      // Required by iOS 14+ before an app may connect to another device
      // on the same local network (e.g. a dev machine's LAN IP) -- shown
      // to the user as a one-time permission prompt.
      NSLocalNetworkUsageDescription:
        "Ledger uses your local network to reach your Ledger server while developing.",
    },
  },
  android: {
    package: "com.ebundw.ledgermobile",
    adaptiveIcon: {
      backgroundColor: DARK_BASE,
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: DARK_BASE,
      },
    ],
    "expo-secure-store",
  ],
  extra: {
    eas: {
      projectId: "61cd30e5-9cc8-45e2-b54d-eaaf7868586e"
    },
  },
};

export default config;
