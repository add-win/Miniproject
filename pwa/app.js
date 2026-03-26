import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging.js";

const FIREBASE_CONFIG = {
  apiKey: CONFIG.apiKey,
  authDomain: "wildguard-92dff.firebaseapp.com",
  projectId: "wildguard-92dff",
  messagingSenderId: "786743626796",
  appId: "1:786743626796:web:1740d36e4b3aa767665589",
};

const VAPID_KEY = CONFIG.vapidKey;
const SERVER_URL = window.location.origin;
const firebaseApp = initializeApp(FIREBASE_CONFIG);
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const liveBanner = document.getElementById("liveBanner");
const bannerText = document.getElementById("bannerText");
const bannerImg = document.getElementById("bannerImg");
const alertList = document.getElementById("alertList");
const statAlerts = document.getElementById("statAlerts");
const statDevices = document.getElementById("statDevices");
const permBlock = document.getElementById("permBlock");
const enableBtn = document.getElementById("enableBtn");
const installBtn = document.getElementById("installBtn");
const resetBtn = document.getElementById("resetBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const homeTab = document.getElementById("homeTab");
const historyTab = document.getElementById("historyTab");

const homeView = document.getElementById("homeView");
const historyView = document.getElementById("historyView");

homeTab.onclick = () => {
  homeView.style.display = "block";
  historyView.style.display = "none";
  homeTab.classList.add("active");
  historyTab.classList.remove("active");
};

historyTab.onclick = () => {
  homeView.style.display = "none";
  historyView.style.display = "block";
  historyTab.classList.add("active");
  homeTab.classList.remove("active");
};

let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  installBtn.style.display = "block";
});
if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === "accepted") installBtn.style.display = "none";
    deferredInstallPrompt = null;
  });
}

const body = document.body;
function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    body.classList.add("light-theme");
    themeToggleBtn.textContent = "🌙";
  } else {
    themeToggleBtn.textContent = "☀️";
  }
}
if (themeToggleBtn) {
  themeToggleBtn.onclick = () => {
    body.classList.toggle("light-theme");
    const isLight = body.classList.contains("light-theme");
    localStorage.setItem("theme", isLight ? "light" : "dark");
    themeToggleBtn.textContent = isLight ? "🌙" : "☀️";
  };
}
initTheme();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./firebase-messaging-sw.js")
    .then((reg) => console.log("✅ Service Worker registered", reg.scope))
    .catch((err) => console.error("❌ SW registration failed:", err));
}

let messaging = null;

async function setupFCM() {
  const supported = await isSupported();
  if (!supported) {
    console.warn("FCM not supported in this browser.");
    permBlock.style.display = "none";
    return;
  }

  messaging = getMessaging(firebaseApp);

  const permission = Notification.permission;

  if (permission === "granted") {
    permBlock.style.display = "none";
    await registerToken();
  } else if (permission === "default") {
    permBlock.style.display = "block";
  } else {
    permBlock.style.display = "none";
  }

  onMessage(messaging, (payload) => {
    console.log("📩 Foreground FCM:", payload);
    const title = payload.data?.title || payload.notification?.title || "Wildlife Alert";
    const body = payload.data?.body || payload.notification?.body || "";
    const img = payload.data?.imageUrl || "";
    showBanner(`${title} — ${body}`, img);
    playAlertSound();
  });
}

async function registerToken() {
  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return;
    console.log("FCM Token:", token);
    await fetch(`${SERVER_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    console.log("✅ Device registered with backend");
  } catch (err) {
    console.error("Token registration error:", err);
  }
}

if (enableBtn) {
  enableBtn.addEventListener("click", async () => {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      if (permBlock) permBlock.style.display = "none";
      await registerToken();
    }
  });
}

async function checkHealth() {
  try {
    const res = await fetch(`${SERVER_URL}/health`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      statusDot.className = "online";
      statusText.textContent = "Backend Online";
      statDevices.textContent = data.registeredDevices ?? "—";
      statAlerts.textContent = data.totalDetections ?? "0";
    }
  } catch {
    statusDot.className = "offline";
    statusText.textContent = "Backend Offline";
    statDevices.textContent = "—";
    statAlerts.textContent = "—";
  }
}

let lastSeenTime = null;
let allDetections = [];

async function fetchDetections() {
  try {
    const res = await fetch(`${SERVER_URL}/detections`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return;
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) return;

    allDetections = data;
    statAlerts.textContent = data.length.toString();
    renderAlertList(data);

    const latest = data[0];
    if (latest && latest.time !== lastSeenTime) {
      if (lastSeenTime !== null) {
        showBanner(latest.message || `⚠️ ${latest.animal} detected at ${latest.location}`, latest.imageUrl || "");
        playAlertSound();
      }
      lastSeenTime = latest.time;
    }
  } catch (err) {
    console.log("Polling error:", err.message);
  }
}

function renderAlertList(detections) {

  const latestList = document.getElementById("latestList");

  latestList.innerHTML = "";
  detections.slice(0, 3).forEach(d => {
    latestList.appendChild(createAlertItem(d));
  });

  alertList.innerHTML = "";
  detections.forEach(d => {
    alertList.appendChild(createAlertItem(d));
  });
}

let bannerTimer = null;
function showBanner(message, imageUrl = "") {
  bannerText.textContent = message;
  if (imageUrl) {
    bannerImg.src = imageUrl;
    bannerImg.style.display = "block";
  } else {
    bannerImg.style.display = "none";
  }
  liveBanner.style.display = "block";
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { liveBanner.style.display = "none"; }, 12000);
}

function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "square";
      gain.gain.setValueAtTime(0.3, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.18);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.2);
    });
  } catch (_) { }
}

function escHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function createAlertItem(d) {
  const item = document.createElement("div");
  item.className = "alert-item";

  const time = d.time || new Date(d.timestamp).toLocaleString();
  const imgHtml = d.imageUrl ? `<img src="${d.imageUrl}" style="max-width: 100%; border-radius: 8px; margin-top: 10px; display: block; border: 1px solid var(--card-border);" />` : "";

  item.innerHTML = `
    <div class="alert-icon">⚠️</div>
    <div class="alert-body">
      <div class="animal">${escHtml(d.animal)}</div>
      <div class="location">📍 ${escHtml(d.location)}</div>
      <div class="time">🕐 ${escHtml(time)}</div>
      ${imgHtml}
    </div>
  `;

  return item;
}

if (resetBtn) {
  resetBtn.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to delete ALL alerts and registered devices? This cannot be undone.")) return;
    try {
      const res = await fetch(`${SERVER_URL}/reset`, { method: "POST" });
      if (res.ok) {
        alert("System reset successfully!");
        window.location.reload();
      } else {
        alert("Failed to reset system.");
      }
    } catch (err) {
      console.error("Reset error:", err);
      alert("Error resetting system");
    }
  });
}

setupFCM();
checkHealth();
fetchDetections();
setInterval(fetchDetections, 5000);
setInterval(checkHealth, 15000);