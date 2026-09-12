"use client";

import { useEffect } from "react";

// Registers the app-shell service worker (public/sw.js) once the page has
// loaded. Renders nothing -- this is a side-effect-only component, mounted
// once from the root layout so every route gets it.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support degrading to "not present" isn't worth surfacing
      // to the user -- the app works identically either way when online.
    });
  }, []);

  return null;
}
