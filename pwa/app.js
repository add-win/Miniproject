import * as API from './scripts/api.js';
import * as UI from './scripts/ui.js';
import * as FCM from './scripts/fcm.js';
import { createAlertCard } from './scripts/components.js';

let lastSeenTime = null;

async function syncState() {
  // 1. Health Status
  const healthData = await API.fetchHealth();
  UI.updateHealthStatus(!!healthData, healthData || {});

  // 2. Fetch Alerts
  const detections = await API.fetchDetections();
  UI.renderLists(detections, createAlertCard);

  // 3. Banner Trigger for New Activity
  if (detections.length > 0) {
    const latest = detections[0];
    if (latest.time !== lastSeenTime) {
      if (lastSeenTime !== null) {
        UI.showLiveBanner(latest.message || `⚠️ ${latest.animal} detected!`, latest.imageUrl || "");
        UI.playAlertSound();
      }
      lastSeenTime = latest.time;
    }
  }
}

function setupEventBindings() {
  UI.setupTabs();
  UI.setupThemeToggle();

  // Custom Install / PWA Prompt
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    UI.els.installBtn.classList.remove("hidden");
  });

  UI.els.installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      UI.els.installBtn.classList.add("hidden");
    }
    deferredPrompt = null;
  });

  // FCM Buttons
  if (UI.els.enableBtn) {
    UI.els.enableBtn.addEventListener("click", FCM.requestPermissionAndRegister);
  }

  // System Reset API Request
  if (UI.els.resetBtn) {
    UI.els.resetBtn.addEventListener("click", async () => {
      if (!confirm("Are you sure you want to delete ALL logs and registered devices? This cannot be undone.")) return;
      const success = await API.resetSystemAPI();
      if (success) {
        alert("System reset safely completed.");
        window.location.reload();
      } else {
        alert("Reset failed. Is the server running?");
      }
    });
  }
}

function bootWildGuardApp() {
  // Service Worker Setup for Background FCM running
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./firebase-messaging-sw.js")
      .then(reg => console.log("✅ Service Worker active, Scope:", reg.scope))
      .catch(err => console.error("❌ SW registration failed:", err));
  }

  setupEventBindings();
  FCM.initFCM();
  
  // Start the polling loop
  syncState();
  setInterval(syncState, 5000); 
}

// Spark up
bootWildGuardApp();
