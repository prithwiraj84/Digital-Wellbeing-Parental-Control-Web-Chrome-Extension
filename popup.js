// Interactive logic for Popup

document.addEventListener("DOMContentLoaded", async () => {
  // Sync latest tracking state from background service worker
  try {
    await chrome.runtime.sendMessage({ type: "FORCE_SAVE_TIME" });
  } catch (err) {
    console.warn("Background worker sync deferred:", err.message);
  }

  await renderPopup();

  // Handle Focus Mode Toggle
  const focusToggle = document.getElementById("focus-toggle");
  focusToggle.addEventListener("change", async (e) => {
    const data = await chrome.storage.local.get("settings");
    const settings = data.settings || {};
    settings.focusMode = e.target.checked;
    await chrome.storage.local.set({ settings });

    // Notify background worker to update DNR rules
    chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("Background worker was not running or failed to reply:", chrome.runtime.lastError.message);
      }
    });

    // Refresh UI
    await renderPopup();
  });

  // Handle open dashboard buttons
  const openDashboardBtn = document.getElementById("open-dashboard-btn");
  const openDashboardIcon = document.getElementById("open-dashboard-icon");

  const openDashboard = () => {
    chrome.runtime.openOptionsPage();
  };

  openDashboardBtn.addEventListener("click", openDashboard);
  openDashboardIcon.addEventListener("click", openDashboard);
});

// Helper: Get local date string YYYY-MM-DD
function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Format seconds to text
function formatTime(totalSeconds) {
  if (totalSeconds <= 0) return "0m";
  if (totalSeconds < 60) return `${totalSeconds}s`;
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Helper: Check if bedtime mode is currently active
function checkBedtimeActive(bedtime) {
  if (!bedtime || !bedtime.enabled) return false;
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentTimeVal = currentHour * 60 + currentMin;
  
  const [startHour, startMin] = bedtime.start.split(":").map(Number);
  const [endHour, endMin] = bedtime.end.split(":").map(Number);
  
  const startTimeVal = startHour * 60 + startMin;
  const endTimeVal = endHour * 60 + endMin;
  
  if (startTimeVal < endTimeVal) {
    return currentTimeVal >= startTimeVal && currentTimeVal <= endTimeVal;
  } else {
    return currentTimeVal >= startTimeVal || currentTimeVal <= endTimeVal;
  }
}

// Main: Render popup interface components
async function renderPopup() {
  // 1. Fetch settings and stats
  const settingsData = await chrome.storage.local.get("settings");
  const settings = settingsData.settings || {};
  
  const statsData = await chrome.storage.local.get("stats");
  const stats = statsData.stats || {};
  
  const today = getTodayDateString();
  const todayStats = stats[today] || {};

  // 2. Set Focus Switch Checked Status
  const focusToggle = document.getElementById("focus-toggle");
  focusToggle.checked = !!settings.focusMode;

  // 3. Check Bedtime Status
  const bedtimeIndicator = document.getElementById("bedtime-indicator");
  if (checkBedtimeActive(settings.bedtimeMode)) {
    bedtimeIndicator.classList.remove("hidden");
  } else {
    bedtimeIndicator.classList.add("hidden");
  }

  // 4. Calculate total daily screen time
  let totalSecondsToday = 0;
  const sitesArray = [];
  for (const [domain, seconds] of Object.entries(todayStats)) {
    totalSecondsToday += seconds;
    sitesArray.push({ domain, seconds });
  }

  const totalTimeHeader = document.getElementById("total-time-today");
  totalTimeHeader.textContent = formatTime(totalSecondsToday);

  // 5. Render Top 3 Sites
  const topSitesList = document.getElementById("top-sites-list");
  topSitesList.innerHTML = ""; // Clear loader

  // Sort sites descending
  sitesArray.sort((a, b) => b.seconds - a.seconds);
  const top3 = sitesArray.slice(0, 3);

  if (top3.length === 0) {
    topSitesList.innerHTML = `
      <div class="flex flex-col items-center justify-center py-6 text-slate-400 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-xs font-semibold">No activity recorded today</span>
        <span class="text-[10px] text-slate-400 mt-0.5">Start browsing to see active tracking!</span>
      </div>
    `;
    return;
  }

  top3.forEach((site, index) => {
    const percentage = totalSecondsToday > 0 ? Math.round((site.seconds / totalSecondsToday) * 100) : 0;
    
    const row = document.createElement("div");
    row.className = "space-y-1";
    row.innerHTML = `
      <div class="flex items-center justify-between text-xs font-medium">
        <div class="flex items-center gap-1.5 truncate max-w-[200px]">
          <span class="w-1.5 h-1.5 rounded-full ${index === 0 ? 'bg-cyan-400' : index === 1 ? 'bg-blue-400' : 'bg-slate-400'}"></span>
          <span class="text-slate-200 truncate" title="${site.domain}">${site.domain}</span>
        </div>
        <div class="flex items-center gap-1.5 text-slate-400">
          <span>${formatTime(site.seconds)}</span>
          <span class="text-[10px] text-slate-400">(${percentage}%)</span>
        </div>
      </div>
      <div class="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
        <div class="h-full bg-gradient-to-r ${index === 0 ? 'from-cyan-400 to-cyan-500' : index === 1 ? 'from-blue-400 to-blue-500' : 'from-slate-400 to-slate-500'} rounded-full" style="width: ${percentage}%"></div>
      </div>
    `;
    topSitesList.appendChild(row);
  });
}
