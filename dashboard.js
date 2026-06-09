// Dashboard Controller for Aegis Wellbeing Options Page

let currentTab = "analytics";
let isSessionUnlocked = false;
let typedPin = [];
let targetTabAfterUnlock = null;
let chartInstance = null;

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize Header Clock
  updateClock();
  setInterval(updateClock, 1000);

  // Load Initial Settings & View
  await switchTab("analytics");
  await renderAnalytics();

  // Navigation Click Handlers
  document.getElementById("tab-btn-analytics").addEventListener("click", () => switchTab("analytics"));
  document.getElementById("tab-btn-parental").addEventListener("click", () => switchTab("parental"));
  document.getElementById("tab-btn-focus").addEventListener("click", () => switchTab("focus"));
  document.getElementById("btn-lock-session").addEventListener("click", lockSession);

  // Timeframe selector change
  document.getElementById("analytics-timeframe").addEventListener("change", renderAnalytics);

  // Search input change
  document.getElementById("domain-search").addEventListener("input", renderAnalytics);

  // Parental Form Submit Handlers
  document.getElementById("form-add-block").addEventListener("submit", handleAddBlock);
  document.getElementById("form-add-timer").addEventListener("submit", handleAddTimer);

  // Focus & Bedtime Form Submit Handlers
  document.getElementById("form-add-allowlist").addEventListener("submit", handleAddAllowlist);
  document.getElementById("btn-save-bedtime").addEventListener("click", handleSaveBedtime);

  // Focus & Bedtime Switch Toggles
  document.getElementById("dashboard-focus-toggle").addEventListener("change", handleFocusToggle);
  document.getElementById("dashboard-bedtime-toggle").addEventListener("change", handleBedtimeToggle);

  // PIN Keypad Setup
  setupKeypad();
});

// Update Header Clock and Date
function updateClock() {
  const now = new Date();
  const timeOptions = { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true };
  const dateOptions = { month: 'long', day: 'numeric', year: 'numeric' };
  
  document.getElementById("header-time").textContent = now.toLocaleTimeString('en-US', timeOptions);
  document.getElementById("header-date").textContent = now.toLocaleDateString('en-US', dateOptions);
}

// ================= TAB NAVIGATION & SECURITY =================

async function switchTab(tabId) {
  const settingsData = await chrome.storage.local.get("settings");
  const settings = settingsData.settings || {};

  // Check locks if going to locked tabs
  if ((tabId === "parental" || tabId === "focus") && !isSessionUnlocked) {
    targetTabAfterUnlock = tabId;
    showPINOverlay(settings.pin);
    return;
  }

  // Update Nav Styling
  const buttons = {
    analytics: document.getElementById("tab-btn-analytics"),
    parental: document.getElementById("tab-btn-parental"),
    focus: document.getElementById("tab-btn-focus")
  };

  const sections = {
    analytics: document.getElementById("view-analytics"),
    parental: document.getElementById("view-parental"),
    focus: document.getElementById("view-focus")
  };

  // Toggle active tab buttons
  for (const [key, btn] of Object.entries(buttons)) {
    if (key === tabId) {
      btn.className = "w-full flex items-center justify-between px-4 py-3 rounded-xl nav-tab-active font-semibold text-sm transition-all";
    } else {
      btn.className = "w-full flex items-center justify-between px-4 py-3 rounded-xl nav-tab-inactive font-semibold text-sm transition-all";
    }
  }

  // Toggle active content views
  for (const [key, sec] of Object.entries(sections)) {
    if (key === tabId) {
      sec.classList.remove("hidden");
    } else {
      sec.classList.add("hidden");
    }
  }

  // Hide PIN overlay
  document.getElementById("pin-overlay").classList.add("hidden");

  currentTab = tabId;

  // Render specific tab contents
  if (tabId === "analytics") {
    document.getElementById("current-view-title").textContent = "Screen Time Analytics";
    document.getElementById("current-view-subtitle").textContent = "View aggregates and detailed usage breakdown";
    await renderAnalytics();
  } else if (tabId === "parental") {
    document.getElementById("current-view-title").textContent = "Parental Configurations";
    document.getElementById("current-view-subtitle").textContent = "Enforce blocking rules and limits for kids";
    await renderParental();
  } else if (tabId === "focus") {
    document.getElementById("current-view-title").textContent = "Focus & Bedtime Modes";
    document.getElementById("current-view-subtitle").textContent = "Configure sleep schedules and distraction-free allowlists";
    await renderFocusBedtime();
  }
}

// Show security lock screen
function showPINOverlay(configuredPin) {
  typedPin = [];
  document.getElementById("pin-overlay").classList.remove("hidden");
  document.getElementById("pin-feedback").textContent = "";

  const setupFlow = document.getElementById("pin-setup-flow");
  const loginFlow = document.getElementById("pin-login-flow");

  if (!configuredPin) {
    // PIN Setup
    setupFlow.classList.remove("hidden");
    loginFlow.classList.add("hidden");
    updatePINDots("setup");
  } else {
    // PIN Verify
    setupFlow.classList.add("hidden");
    loginFlow.classList.remove("hidden");
    updatePINDots("login");
  }
}

// Update UI dots representing PIN characters typed
function updatePINDots(flowType) {
  const dots = document.querySelectorAll(flowType === "setup" ? ".pin-dot-setup" : ".pin-dot-login");
  dots.forEach((dot, index) => {
    if (index < typedPin.length) {
      dot.classList.add("filled");
    } else {
      dot.classList.remove("filled");
    }
  });
}

// Numerical Keypad Event Hooking
function setupKeypad() {
  const keys = document.querySelectorAll(".keypad-btn");
  keys.forEach(key => {
    key.addEventListener("click", async () => {
      const val = key.getAttribute("data-val");
      const action = key.getAttribute("data-action");

      const settingsData = await chrome.storage.local.get("settings");
      const settings = settingsData.settings || {};
      const flow = settings.pin ? "login" : "setup";

      if (val !== null) {
        if (typedPin.length < 4) {
          typedPin.push(val);
          updatePINDots(flow);
        }

        if (typedPin.length === 4) {
          // Add 100ms lag for visual animation update before verification triggers
          setTimeout(() => verifyPIN(typedPin.join(""), settings), 100);
        }
      } else if (action === "clear") {
        typedPin = [];
        updatePINDots(flow);
        document.getElementById("pin-feedback").textContent = "";
      } else if (action === "backspace") {
        typedPin.pop();
        updatePINDots(flow);
        document.getElementById("pin-feedback").textContent = "";
      }
    });
  });
}

// Validate inputted pin
async function verifyPIN(pinStr, settings) {
  const feedback = document.getElementById("pin-feedback");
  const flow = settings.pin ? "login" : "setup";

  if (flow === "setup") {
    // Setup flow: Save new PIN
    settings.pin = pinStr;
    await chrome.storage.local.set({ settings });
    isSessionUnlocked = true;
    
    // Unlock indicators
    updateLockBadges(false);
    
    feedback.className = "text-xs font-semibold mt-4 h-4 text-cyan-400";
    feedback.textContent = "PIN created successfully!";
    
    setTimeout(async () => {
      document.getElementById("pin-overlay").classList.add("hidden");
      await switchTab(targetTabAfterUnlock || "parental");
    }, 800);
  } else {
    // Login flow: Verify PIN
    if (pinStr === settings.pin) {
      isSessionUnlocked = true;
      updateLockBadges(false);
      
      feedback.className = "text-xs font-semibold mt-4 h-4 text-cyan-400";
      feedback.textContent = "Unlocked!";
      
      setTimeout(async () => {
        document.getElementById("pin-overlay").classList.add("hidden");
        await switchTab(targetTabAfterUnlock || "parental");
      }, 500);
    } else {
      // Wrong PIN
      typedPin = [];
      updatePINDots("login");
      feedback.className = "text-xs font-semibold mt-4 h-4 text-red-500 animate-pulse";
      feedback.textContent = "Incorrect PIN. Please try again.";
    }
  }
}

// Set visual lock badges in navigation
function updateLockBadges(locked) {
  const pBadge = document.getElementById("parental-lock-badge");
  const fBadge = document.getElementById("focus-lock-badge");
  const banner = document.getElementById("parental-unlocked-banner");

  if (locked) {
    pBadge.textContent = "LOCKED";
    pBadge.className = "text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded font-mono";
    fBadge.textContent = "LOCKED";
    fBadge.className = "text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded font-mono";
    banner.classList.add("hidden");
  } else {
    pBadge.textContent = "UNLOCKED";
    pBadge.className = "text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded font-mono";
    fBadge.textContent = "UNLOCKED";
    fBadge.className = "text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded font-mono";
    banner.classList.remove("hidden");
  }
}

// Lock options page
function lockSession() {
  isSessionUnlocked = false;
  targetTabAfterUnlock = null;
  updateLockBadges(true);
  switchTab("analytics");
}

// ================= ANALYTICS MODULE =================

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

// Helper: Date subtraction YYYY-MM-DD
function getPastDateString(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Get local date string YYYY-MM-DD
function getTodayDateString() {
  return getPastDateString(0);
}

// Helper: Categorise base domains
function categorizeDomain(domain) {
  const entertainment = ['youtube.com', 'netflix.com', 'twitch.tv', 'vimeo.com', 'spotify.com', 'disneyplus.com', 'hbo.com', 'hulu.com', 'primevideo.com'];
  const social = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'reddit.com', 'tiktok.com', 'linkedin.com', 'pinterest.com', 'tumblr.com', 'whatsapp.com', 'discord.gg', 'discord.com'];
  const productivity = ['github.com', 'gitlab.com', 'stackoverflow.com', 'notion.so', 'docs.google.com', 'figma.com', 'slack.com', 'trello.com', 'zoom.us', 'meet.google.com', 'canvas', 'outlook.live.com', 'mail.google.com', 'gmail.com'];
  const education = ['wikipedia.org', 'khanacademy.org', 'coursera.org', 'duolingo.com', 'udemy.com', 'edx.org', 'britannica.com', 'w3schools.com', 'mdn.mozilla.org', 'researchgate.net'];
  const search = ['google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com', 'baidu.com'];

  const d = domain.toLowerCase();
  
  if (entertainment.some(site => d === site || d.endsWith('.' + site))) return 'Entertainment';
  if (social.some(site => d === site || d.endsWith('.' + site))) return 'Social Media';
  if (productivity.some(site => d === site || d.endsWith('.' + site))) return 'Productivity';
  if (education.some(site => d === site || d.endsWith('.' + site))) return 'Education';
  if (search.some(site => d === site || d.endsWith('.' + site))) return 'Search & Info';
  
  return 'Utility & Others';
}

// Render Analytics Tab details
async function renderAnalytics() {
  const statsData = await chrome.storage.local.get("stats");
  const stats = statsData.stats || {};

  const timeframe = document.getElementById("analytics-timeframe").value;
  const searchVal = document.getElementById("domain-search").value.toLowerCase().trim();

  // Aggregate stats based on timeframe selection
  let aggregated = {};

  if (timeframe === "today") {
    aggregated = stats[getTodayDateString()] || {};
  } else if (timeframe === "yesterday") {
    aggregated = stats[getPastDateString(1)] || {};
  } else if (timeframe === "week") {
    // Last 7 days sum
    for (let i = 0; i < 7; i++) {
      const dayData = stats[getPastDateString(i)] || {};
      for (const [domain, sec] of Object.entries(dayData)) {
        aggregated[domain] = (aggregated[domain] || 0) + sec;
      }
    }
  } else if (timeframe === "month") {
    // Last 30 days sum
    for (let i = 0; i < 30; i++) {
      const dayData = stats[getPastDateString(i)] || {};
      for (const [domain, sec] of Object.entries(dayData)) {
        aggregated[domain] = (aggregated[domain] || 0) + sec;
      }
    }
  }

  // Calculate Metrics
  let totalTimeSeconds = 0;
  let uniqueDomains = 0;
  const filteredArray = [];

  for (const [domain, seconds] of Object.entries(aggregated)) {
    totalTimeSeconds += seconds;
    uniqueDomains++;

    if (!searchVal || domain.toLowerCase().includes(searchVal)) {
      filteredArray.push({ domain, seconds });
    }
  }

  // Sort filtered list by seconds descending
  filteredArray.sort((a, b) => b.seconds - a.seconds);

  // Update Stats Widgets
  document.getElementById("stat-screen-time").textContent = formatTime(totalTimeSeconds);
  document.getElementById("stat-tracked-sites").textContent = uniqueDomains.toString();

  const settingsData = await chrome.storage.local.get("settings");
  const settings = settingsData.settings || {};
  const blockCount = (settings.blocklist || []).length + Object.keys(settings.appTimers || {}).length;
  document.getElementById("stat-active-blocks").textContent = blockCount.toString();

  // Update Category Breakdown
  updateCategoryBreakdown(aggregated, totalTimeSeconds);

  // Render Chart
  renderAnalyticsChart(aggregated);

  // Render Logs Table
  const tableBody = document.getElementById("analytics-table-body");
  tableBody.innerHTML = "";

  if (filteredArray.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" class="py-8 text-center text-slate-400">
          No records found matching parameters.
        </td>
      </tr>
    `;
    return;
  }

  filteredArray.forEach(item => {
    const percentage = totalTimeSeconds > 0 ? Math.round((item.seconds / totalTimeSeconds) * 100) : 0;
    const row = document.createElement("tr");
    row.className = "hover:bg-slate-900/35 border-b border-slate-800/10 transition-colors";
    row.innerHTML = `
      <td class="py-3.5 px-4 font-semibold text-slate-200">${item.domain}</td>
      <td class="py-3.5 px-4 text-slate-400">${formatTime(item.seconds)}</td>
      <td class="py-3.5 px-4 text-slate-400">${percentage}%</td>
      <td class="py-3.5 px-4">
        <div class="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full" style="width: ${percentage}%"></div>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

// Render chart using Chart.js library
function renderAnalyticsChart(dataObj) {
  const canvas = document.getElementById("analytics-chart");
  const ctx = canvas.getContext("2d");

  // Sort and isolate top 7 domains
  const sorted = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
  const top7 = sorted.slice(0, 7);

  const labels = top7.map(item => item[0]);
  const data = top7.map(item => Math.round(item[1] / 60)); // minutes spent

  if (chartInstance) {
    chartInstance.destroy();
  }

  if (labels.length === 0) {
    // Render text on canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#94A3B8";
    ctx.font = "14px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No time recorded in selected timeframe", canvas.width / 2, canvas.height / 2);
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, 'rgba(0, 229, 255, 0.35)');
  gradient.addColorStop(1, 'rgba(99, 102, 241, 0.02)');

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Minutes spent',
        data: data,
        backgroundColor: gradient,
        borderColor: '#00E5FF',
        borderWidth: 1.5,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(0, 229, 255, 0.5)',
        hoverBorderColor: '#FFFFFF'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0F111A',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleFont: { family: 'Outfit', weight: 'bold' },
          bodyFont: { family: 'Outfit' },
          callbacks: {
            label: (context) => {
              const val = context.raw;
              if (val >= 60) {
                const hrs = Math.floor(val / 60);
                const mins = val % 60;
                return ` Active: ${hrs}h ${mins}m`;
              }
              return ` Active: ${val}m`;
            }
          }
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false },
          ticks: { color: '#94A3B8', font: { family: 'Outfit', size: 10 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#CBD5E1', font: { family: 'Outfit', size: 10 } }
        }
      }
    }
  });
}

// Render categorized horizontal metrics bars
function updateCategoryBreakdown(dataObj, totalTimeSeconds) {
  const breakdownList = document.getElementById("analytics-breakdown-list");
  breakdownList.innerHTML = "";

  const categories = {
    'Entertainment': { seconds: 0, color: 'bg-gradient-to-r from-red-400 to-rose-500', text: 'text-red-400' },
    'Social Media': { seconds: 0, color: 'bg-gradient-to-r from-purple-400 to-indigo-500', text: 'text-purple-400' },
    'Productivity': { seconds: 0, color: 'bg-gradient-to-r from-emerald-400 to-teal-500', text: 'text-green-400' },
    'Education': { seconds: 0, color: 'bg-gradient-to-r from-cyan-400 to-blue-500', text: 'text-cyan-400' },
    'Search & Info': { seconds: 0, color: 'bg-gradient-to-r from-blue-400 to-indigo-600', text: 'text-blue-400' },
    'Utility & Others': { seconds: 0, color: 'bg-gradient-to-r from-slate-400 to-slate-500', text: 'text-slate-400' }
  };

  for (const [domain, seconds] of Object.entries(dataObj)) {
    const cat = categorizeDomain(domain);
    categories[cat].seconds += seconds;
  }

  // Sort categories by time spent
  const sortedCats = Object.entries(categories).sort((a, b) => b[1].seconds - a[1].seconds);

  sortedCats.forEach(([name, details]) => {
    if (details.seconds === 0 && totalTimeSeconds > 0) return; // Hide empty cats unless total time is 0
    const pct = totalTimeSeconds > 0 ? Math.round((details.seconds / totalTimeSeconds) * 100) : 0;
    
    const div = document.createElement("div");
    div.className = "space-y-1";
    div.innerHTML = `
      <div class="flex items-center justify-between text-xs font-semibold">
        <span class="text-slate-300">${name}</span>
        <div class="flex items-center gap-1.5">
          <span class="${details.text}">${formatTime(details.seconds)}</span>
          <span class="text-[10px] text-slate-400">(${pct}%)</span>
        </div>
      </div>
      <div class="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
        <div class="h-full ${details.color} rounded-full" style="width: ${pct}%"></div>
      </div>
    `;
    breakdownList.appendChild(div);
  });
}

// ================= PARENTAL CONTROLS MODULE =================

// Render Blocklist and App Timers configuration lists
async function renderParental() {
  const settingsData = await chrome.storage.local.get("settings");
  const settings = settingsData.settings || {};

  const statsData = await chrome.storage.local.get("stats");
  const stats = statsData.stats || {};
  const today = getTodayDateString();
  const todayStats = stats[today] || {};

  // 1. Render Blocklist
  const blocklistContainer = document.getElementById("blocklist-container");
  blocklistContainer.innerHTML = "";
  const list = settings.blocklist || [];

  if (list.length === 0) {
    blocklistContainer.innerHTML = `
      <div class="text-center py-6 text-slate-400 text-xs">
        No blocked websites. Parental blocklist is empty.
      </div>
    `;
  } else {
    list.forEach(domain => {
      const card = document.createElement("div");
      card.className = "flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-800/60 hover:border-red-500/20 transition-all";
      card.innerHTML = `
        <span class="text-xs font-semibold text-slate-200 truncate max-w-[180px]" title="${domain}">${domain}</span>
        <button class="btn-delete-block text-slate-500 hover:text-red-400 transition-colors p-1" data-domain="${domain}">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      `;
      blocklistContainer.appendChild(card);
    });

    // Attach delete handlers
    document.querySelectorAll(".btn-delete-block").forEach(btn => {
      btn.addEventListener("click", () => handleDeleteBlock(btn.getAttribute("data-domain")));
    });
  }

  // 2. Render App Timers
  const timersContainer = document.getElementById("timers-container");
  timersContainer.innerHTML = "";
  const timers = settings.appTimers || {};

  const timersKeys = Object.keys(timers);

  if (timersKeys.length === 0) {
    timersContainer.innerHTML = `
      <div class="text-center py-6 text-slate-400 text-xs">
        No active app timers defined.
      </div>
    `;
  } else {
    timersKeys.forEach(domain => {
      const limitSeconds = timers[domain];
      const limitMins = Math.round(limitSeconds / 60);
      const elapsedSeconds = todayStats[domain] || 0;
      const elapsedMins = Math.round(elapsedSeconds / 60);
      
      const pct = Math.min(Math.round((elapsedSeconds / limitSeconds) * 100), 100);
      const isExceeded = elapsedSeconds >= limitSeconds;

      const card = document.createElement("div");
      card.className = `p-4 rounded-xl bg-slate-900/50 border ${isExceeded ? 'border-red-500/20' : 'border-slate-800/60'} space-y-2`;
      card.innerHTML = `
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-slate-200 truncate max-w-[150px]" title="${domain}">${domain}</span>
          <div class="flex items-center gap-2">
            <span class="font-medium text-slate-400">${elapsedMins}m / ${limitMins}m</span>
            ${isExceeded ? '<span class="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-1 py-0.2 rounded font-bold uppercase tracking-wider">Blocked</span>' : ''}
            <button class="btn-delete-timer text-slate-500 hover:text-red-400 transition-colors pl-1" data-domain="${domain}">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        <div class="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
          <div class="h-full ${isExceeded ? 'bg-red-500' : 'bg-cyan-400'} rounded-full" style="width: ${pct}%"></div>
        </div>
      `;
      timersContainer.appendChild(card);
    });

    // Attach delete handlers
    document.querySelectorAll(".btn-delete-timer").forEach(btn => {
      btn.addEventListener("click", () => handleDeleteTimer(btn.getAttribute("data-domain")));
    });
  }
}

// Clean Domain Input (strip http, www)
function cleanDomain(input) {
  let domain = input.trim().toLowerCase();
  if (domain.startsWith("http://")) domain = domain.substring(7);
  if (domain.startsWith("https://")) domain = domain.substring(8);
  if (domain.startsWith("www.")) domain = domain.substring(4);
  // Remove slash routes if included
  const slashIndex = domain.indexOf("/");
  if (slashIndex !== -1) {
    domain = domain.substring(0, slashIndex);
  }
  return domain;
}

// Add Domain to Blocklist
async function handleAddBlock(e) {
  e.preventDefault();
  const input = document.getElementById("input-block-domain");
  const domain = cleanDomain(input.value);

  if (!domain) return;

  const data = await chrome.storage.local.get("settings");
  const settings = data.settings || {};
  const list = settings.blocklist || [];

  if (!list.includes(domain)) {
    list.push(domain);
    settings.blocklist = list;
    await chrome.storage.local.set({ settings });

    // Notify BG Worker to update rules
    chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" });
    
    // Reset Form & Render
    input.value = "";
    await renderParental();
  }
}

// Delete Domain from Blocklist
async function handleDeleteBlock(domain) {
  const data = await chrome.storage.local.get("settings");
  const settings = data.settings || {};
  const list = settings.blocklist || [];

  settings.blocklist = list.filter(item => item !== domain);
  await chrome.storage.local.set({ settings });

  // Notify BG Worker to update rules
  chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" });

  await renderParental();
}

// Add daily limit App Timer
async function handleAddTimer(e) {
  e.preventDefault();
  const domainInput = document.getElementById("input-timer-domain");
  const limitInput = document.getElementById("input-timer-limit");

  const domain = cleanDomain(domainInput.value);
  const limitMins = parseInt(limitInput.value);

  if (!domain || isNaN(limitMins) || limitMins <= 0) return;

  const data = await chrome.storage.local.get("settings");
  const settings = data.settings || {};
  const timers = settings.appTimers || {};

  timers[domain] = limitMins * 60; // store in seconds
  settings.appTimers = timers;
  
  await chrome.storage.local.set({ settings });

  // Notify BG Worker to update rules
  chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" });

  // Reset inputs & render
  domainInput.value = "";
  limitInput.value = "";
  await renderParental();
}

// Delete App Timer
async function handleDeleteTimer(domain) {
  const data = await chrome.storage.local.get("settings");
  const settings = data.settings || {};
  const timers = settings.appTimers || {};

  delete timers[domain];
  settings.appTimers = timers;

  await chrome.storage.local.set({ settings });

  // Notify BG Worker to update rules
  chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" });

  await renderParental();
}

// ================= FOCUS & BEDTIME MODULE =================

// Render Focus Allowlist and Bedtime schedules
async function renderFocusBedtime() {
  const settingsData = await chrome.storage.local.get("settings");
  const settings = settingsData.settings || {};

  // 1. Sync Focus Toggle
  document.getElementById("dashboard-focus-toggle").checked = !!settings.focusMode;

  // 2. Sync Bedtime Toggle & Inputs
  document.getElementById("dashboard-bedtime-toggle").checked = !!settings.bedtimeMode?.enabled;
  document.getElementById("bedtime-start").value = settings.bedtimeMode?.start || "22:00";
  document.getElementById("bedtime-end").value = settings.bedtimeMode?.end || "06:00";

  // 3. Render Focus Allowlist
  const allowlistContainer = document.getElementById("allowlist-container");
  allowlistContainer.innerHTML = "";
  const allowlist = settings.focusAllowlist || [];

  if (allowlist.length === 0) {
    allowlistContainer.innerHTML = `
      <div class="col-span-2 text-center py-4 text-slate-400 text-xs">
        Focus Allowlist is empty.
      </div>
    `;
  } else {
    allowlist.forEach(domain => {
      const tag = document.createElement("div");
      tag.className = "flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800/80 text-xs hover:border-cyan-500/20 transition-all";
      tag.innerHTML = `
        <span class="text-slate-200 truncate max-w-[100px]" title="${domain}">${domain}</span>
        <button class="btn-delete-allow text-slate-500 hover:text-red-400 transition-colors ml-2" data-domain="${domain}">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2".5 d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      `;
      allowlistContainer.appendChild(tag);
    });

    // Attach delete allowlist handlers
    document.querySelectorAll(".btn-delete-allow").forEach(btn => {
      btn.addEventListener("click", () => handleDeleteAllowlist(btn.getAttribute("data-domain")));
    });
  }
}

// Toggle Focus Mode Switch
async function handleFocusToggle(e) {
  const data = await chrome.storage.local.get("settings");
  const settings = data.settings || {};
  settings.focusMode = e.target.checked;
  await chrome.storage.local.set({ settings });

  // Update Background Worker DNR rules
  chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" });
}

// Toggle Bedtime Mode Switch
async function handleBedtimeToggle(e) {
  const data = await chrome.storage.local.get("settings");
  const settings = data.settings || {};
  
  if (!settings.bedtimeMode) {
    settings.bedtimeMode = { enabled: false, start: "22:00", end: "06:00" };
  }
  
  settings.bedtimeMode.enabled = e.target.checked;
  await chrome.storage.local.set({ settings });

  // Update Background Worker DNR rules
  chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" });
}

// Add website to Focus Allowlist
async function handleAddAllowlist(e) {
  e.preventDefault();
  const input = document.getElementById("input-allow-domain");
  const domain = cleanDomain(input.value);

  if (!domain) return;

  const data = await chrome.storage.local.get("settings");
  const settings = data.settings || {};
  const allowlist = settings.focusAllowlist || [];

  if (!allowlist.includes(domain)) {
    allowlist.push(domain);
    settings.focusAllowlist = allowlist;
    await chrome.storage.local.set({ settings });

    // Notify BG Worker to update rules
    chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" });

    input.value = "";
    await renderFocusBedtime();
  }
}

// Delete website from Focus Allowlist
async function handleDeleteAllowlist(domain) {
  const data = await chrome.storage.local.get("settings");
  const settings = data.settings || {};
  const allowlist = settings.focusAllowlist || [];

  settings.focusAllowlist = allowlist.filter(item => item !== domain);
  await chrome.storage.local.set({ settings });

  // Notify BG Worker to update rules
  chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" });

  await renderFocusBedtime();
}

// Save bedtime schedule parameters
async function handleSaveBedtime() {
  const startVal = document.getElementById("bedtime-start").value;
  const endVal = document.getElementById("bedtime-end").value;

  const data = await chrome.storage.local.get("settings");
  const settings = data.settings || {};

  if (!settings.bedtimeMode) {
    settings.bedtimeMode = { enabled: false, start: "22:00", end: "06:00" };
  }

  settings.bedtimeMode.start = startVal;
  settings.bedtimeMode.end = endVal;

  await chrome.storage.local.set({ settings });

  // Notify BG Worker to update rules
  chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" });

  // Show visual save confirmation in button
  const saveBtn = document.getElementById("btn-save-bedtime");
  const originalText = saveBtn.textContent;
  saveBtn.textContent = "Schedule Saved!";
  saveBtn.className = "w-full bg-green-500 text-slate-950 font-bold text-xs py-2 rounded-xl mt-2";
  
  setTimeout(() => {
    saveBtn.textContent = originalText;
    saveBtn.className = "w-full glow-btn-cyan text-xs py-2 rounded-xl mt-2";
  }, 1500);
}
