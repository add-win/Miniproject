export const els = {
  statusPing: document.getElementById("statusPing"),
  statusText: document.getElementById("statusText"),
  liveBanner: document.getElementById("liveBanner"),
  bannerText: document.getElementById("bannerText"),
  bannerImg: document.getElementById("bannerImg"),
  statAlerts: document.getElementById("statAlerts"),
  statDevices: document.getElementById("statDevices"),
  permBlock: document.getElementById("permBlock"),
  enableBtn: document.getElementById("enableBtn"),
  installBtn: document.getElementById("installBtn"),
  latestList: document.getElementById("latestList"),
  alertList: document.getElementById("alertList"),
  resetBtn: document.getElementById("resetBtn"),
  clearLogsBtn: document.getElementById("clearLogsBtn"),
  homeTab: document.getElementById("homeTab"),
  historyTab: document.getElementById("historyTab"),
  controlTab: document.getElementById("controlTab"),
  homeView: document.getElementById("homeView"),
  historyView: document.getElementById("historyView"),
  controlView: document.getElementById("controlView"),
  themeToggleBtn: document.getElementById("themeToggleBtn")
};

export function setupTabs() {
  els.homeTab.onclick = () => {
    els.homeView.classList.remove("hidden");
    els.historyView.classList.add("hidden");
    els.controlView.classList.add("hidden");
    els.homeTab.classList.add("active");
    els.historyTab.classList.remove("active");
    els.controlTab.classList.remove("active");
  };

  els.historyTab.onclick = () => {
    els.homeView.classList.add("hidden");
    els.historyView.classList.remove("hidden");
    els.controlView.classList.add("hidden");
    els.historyTab.classList.add("active");
    els.homeTab.classList.remove("active");
    els.controlTab.classList.remove("active");
  };

  els.controlTab.onclick = () => {
    els.homeView.classList.add("hidden");
    els.historyView.classList.add("hidden");
    els.controlView.classList.remove("hidden");
    els.controlTab.classList.add("active");
    els.homeTab.classList.remove("active");
    els.historyTab.classList.remove("active");
  };
}

export function setupThemeToggle() {
  if (!els.themeToggleBtn) return;
  els.themeToggleBtn.onclick = () => {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('color-theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('color-theme', 'dark');
    }
  };
}

export function updateHealthStatus(isOnline, data) {
  if (!els.statusPing || !els.statusText) return;

  if (isOnline) {
    els.statusPing.classList.remove("bg-rose-500", "bg-rose-600");
    els.statusPing.classList.add("bg-emerald-500", "dark:bg-emerald-400", "animate-ping");
    els.statusText.textContent = "System Online";
    els.statusText.classList.remove("text-rose-500", "text-rose-400");
    els.statusText.classList.add("text-emerald-600", "dark:text-emerald-400");

    if (els.statDevices) els.statDevices.textContent = data.registeredDevices ?? "—";
    if (els.statAlerts) els.statAlerts.textContent = data.totalDetections ?? "0";
  } else {
    els.statusPing.classList.add("bg-rose-500");
    els.statusPing.classList.remove("bg-emerald-500", "dark:bg-emerald-400", "animate-ping");
    els.statusText.textContent = "System Offline";
    els.statusText.classList.add("text-rose-500");
    els.statusText.classList.remove("text-emerald-600", "dark:text-emerald-400");
    if (els.statDevices) els.statDevices.textContent = "—";
  }
}

export function renderLists(detections, createCardFn) {
  if (!els.latestList || !els.alertList) return;

  if (!detections || detections.length === 0) {
    const emptyHtml = `<div class="text-center py-12 opacity-40 animate-slide-in">
      <div class="text-5xl mb-4 grayscale">🌿</div>
      <p class="font-medium tracking-wide uppercase text-sm text-slate-500 dark:text-slate-400">No activity detected.</p></div>`;
    els.latestList.innerHTML = emptyHtml;
    els.alertList.innerHTML = emptyHtml;
    return;
  }

  if (els.statAlerts) els.statAlerts.textContent = detections.length;

  // Render Latest (top 3)
  els.latestList.innerHTML = "";
  detections.slice(0, 3).forEach((d, i) => {
    els.latestList.appendChild(createCardFn(d, i));
  });

  // Render History
  els.alertList.innerHTML = "";
  detections.forEach((d, i) => {
    els.alertList.appendChild(createCardFn(d, Math.min(i, 10)));
  });
}

let bannerTimer = null;
export function showLiveBanner(message, imageUrl = "") {
  els.bannerText.textContent = message;
  if (imageUrl) {
    els.bannerImg.src = imageUrl;
    els.bannerImg.classList.remove("hidden");
  } else {
    els.bannerImg.classList.add("hidden");
  }

  els.liveBanner.classList.add("show");

  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    els.liveBanner.classList.remove("show");
  }, 8000);
}

export function playAlertSound() {
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
