import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getMessaging, getToken, isSupported, onMessage } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging.js";
import * as API from './api.js';
import * as UI from './ui.js';

const FIREBASE_CONFIG = {
  apiKey: CONFIG.apiKey,
  authDomain: "wildguard-d6b3a.firebaseapp.com",
  projectId: "wildguard-d6b3a",
  messagingSenderId: "667786072615",
  appId: "1:667786072615:web:5270b954d91a1787d6f402",
};
const VAPID_KEY = CONFIG.vapidKey;

let messaging = null;

export async function initFCM() {
  const supported = await isSupported();
  if (!supported) {
    console.warn("FCM not supported on this browser.");
    return;
  }

  const app = initializeApp(FIREBASE_CONFIG);
  messaging = getMessaging(app);

  if (Notification.permission === "granted") {
    UI.els.permBlock.classList.add("hidden");
    await registerDevice();
  } else if (Notification.permission === "default") {
    // Show prompt banner
    UI.els.permBlock.classList.remove("hidden");
  }

  // Handle Foreground Messages seamlessly
  onMessage(messaging, (payload) => {
    console.log("📩 Foreground FCM:", payload);
    const title = payload.notification?.title || "Wildlife Alert";
    const body = payload.notification?.body || "";
    const img = payload.data?.imageUrl || "";
    UI.showLiveBanner(`${title} — ${body}`, img);
    UI.playAlertSound();

    // Also fire OS system notification so it appears in status bar even in foreground
    if (Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/icons/icon-192.png",
        tag: "wildguard-foreground-alert",
      });
    }
  });
}

export async function requestPermissionAndRegister() {
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    UI.els.permBlock.classList.add("hidden");
    await registerDevice();
  }
}

async function registerDevice() {
  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return;
    const success = await API.registerTokenOnServer(token);
    if (success) {
      console.log("✅ Device successfully registered with backend");
    }
  } catch (err) {
    console.error("Token registration error:", err);
  }
}
