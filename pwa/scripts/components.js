function escHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function createAlertCard(d, index) {
  const item = document.createElement("div");
  const delay = index * 100;
  
  // Dynamic Threat colors for Light & Dark mode compatibility
  let borderLeft = "border-l-emerald-500";
  let bgBadge = "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30";
  let iconColor = "text-emerald-700 dark:text-emerald-400";
  
  const animal = (d.animal || "Unknown").toUpperCase();
  if (animal.includes("LION") || animal.includes("TIGER") || animal.includes("LEOPARD") || animal.includes("BEAR")) {
    borderLeft = "border-l-rose-500";
    bgBadge = "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/30";
    iconColor = "text-rose-600 dark:text-rose-400";
  } else if (animal.includes("BOAR") || animal.includes("RHINO") || animal.includes("BISON")) {
    borderLeft = "border-l-amber-500";
    bgBadge = "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30";
    iconColor = "text-amber-600 dark:text-amber-400";
  }

  // Highly transparent returned to .glass
  item.className = `glass rounded-3xl p-5 flex gap-4 items-start border-t-0 border-r-0 border-b-0 border-l-[5px] ${borderLeft} animate-slide-in opacity-0 shadow-lg`;
  item.style.animationDelay = `${delay}ms`;

  const timeStr = d.time || new Date(d.timestamp).toLocaleString();
  const imgHtml = d.imageUrl 
    ? `<div class="mt-4 overflow-hidden rounded-2xl border-2 border-slate-200 dark:border-white/10 relative group bg-black/20 dark:bg-black/50 shadow-inner">
         <img src="${d.imageUrl}" class="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-105" loading="lazy" />
       </div>` 
    : "";

  item.innerHTML = `
    <div class="text-4xl mt-1 drop-shadow-md">⚠️</div>
    <div class="flex-1 w-full min-w-0">
      <div class="flex flex-wrap justify-between items-center gap-2 mb-2">
        <h3 class="font-black text-2xl text-slate-800 dark:text-white truncate pr-2 drop-shadow-sm tracking-tight">${escHtml(d.animal)}</h3>
        <span class="text-[11px] uppercase font-black px-3 py-1 rounded-full border ${bgBadge} tracking-[0.1em] shadow-sm">Identified</span>
      </div>
      <div class="flex flex-col gap-2 text-[0.95rem] font-semibold text-slate-600 dark:text-slate-300 mt-2">
        <span class="flex items-center gap-2">
          <svg class="w-5 h-5 ${iconColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          ${escHtml(d.location)}
        </span>
        <span class="flex items-center gap-2">
          <svg class="w-5 h-5 ${iconColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          ${escHtml(timeStr)}
        </span>
      </div>
      ${imgHtml}
    </div>
  `;

  return item;
}
