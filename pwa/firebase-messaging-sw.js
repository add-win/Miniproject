// firebase-messaging-sw.js
// This service worker handles background FCM push notifications.
// It MUST be at the root of your served folder.

importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js");
importScripts("./config.js");

// ⚠️  Keep this in sync with the config in app.js
firebase.initializeApp({
  apiKey:            CONFIG.apiKey,
  authDomain:        "wildguard-92dff.firebaseapp.com",
  projectId:         "wildguard-92dff",
  messagingSenderId: "786743626796",
  appId:             "1:786743626796:web:1740d36e4b3aa767665589",
});

const messaging = firebase.messaging();

// Show notification when app is in background / closed
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Background FCM received:", payload);

  const title = payload.data?.title || payload.notification?.title || "⚠️ Wildlife Alert";
  const body  = payload.data?.body || payload.notification?.body  || "Animal detected!";
  const icon  = payload.data?.imageUrl      || "./icons/icon-192.png";

  return self.registration.showNotification(title, {
    body,
    icon,
    image: payload.data?.imageUrl,
    badge: "./icons/icon-192.png",
    vibrate: [500, 200, 500, 200, 500], // More aggressive vibration pattern
    tag: "wildguard-alert",
    renotify: true,
    requireInteraction: true, // Forces notification to stay until dismissed
    silent: false, // Ensures the system default sound plays
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
