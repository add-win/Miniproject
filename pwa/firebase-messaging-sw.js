// firebase-messaging-sw.js
// This service worker handles background FCM push notifications.
// It MUST be at the root of your served folder.

importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js");
importScripts("./config.js");

// ⚠️  Keep this in sync with the config in app.js
firebase.initializeApp({
  apiKey: CONFIG.apiKey,
  authDomain: "wildguard-d6b3a.firebaseapp.com",
  projectId: "wildguard-d6b3a",
  messagingSenderId: "667786072615",
  appId: "1:667786072615:web:5270b954d91a1787d6f402",
});

const messaging = firebase.messaging();

// Show notification when app is in background / closed
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Background FCM received:", payload);

  const title = payload.notification?.title || "⚠️ Wildlife Alert";
  const body = payload.notification?.body || "Animal detected!";
  const icon = payload.data?.imageUrl || "./icons/icon-192.png";

  self.registration.showNotification(title, {
    body,
    icon,
    image: payload.data?.imageUrl, // This enables large rich photo display in the notification tray
    badge: "./icons/icon-192.png",
    vibrate: [200, 100, 200],
    tag: "wildguard-alert",       // replaces previous notification instead of stacking
    renotify: true,
    data: payload.data || {},
  });
});

// Click on notification → open / focus the PWA
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});
