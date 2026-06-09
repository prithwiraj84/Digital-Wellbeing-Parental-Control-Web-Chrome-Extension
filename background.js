// Background Service Worker for Digital Wellbeing & Parental Control Extension

let activeDomain = null;
let lastActiveTime = null;
let isIdle = false;
let lastCheckDate = getTodayDateString();
let tickInterval = null;
let warnedDomains = {};

// Default configuration
function getDefaultSettings() {
  return {
    pin: null, // Parental Control PIN (null if not set)
    blocklist: [], // List of blocked domains
    appTimers: {}, // Domain name -> limit in seconds
    focusMode: false, // Focus mode toggle
    focusAllowlist: ["wikipedia.org", "khanacademy.org", "coursera.org", "duolingo.com"],
    bedtimeMode: {
      enabled: false,
      start: "22:00",
      end: "06:00"
    }
  };
}

// Helper: Get local date string YYYY-MM-DD
function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Extract clean domain name from URL
function getDomain(url) {
  if (!url) return null;
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
      let hostname = parsedUrl.hostname;
      if (hostname.startsWith("www.")) {
        hostname = hostname.substring(4);
      }
      return hostname;
    }
  } catch (e) {
    // Ignore invalid URLs
  }
  return null;
}

// Helper: Check if Bedtime Mode is active
function checkBedtimeActive(bedtime) {
  if (!bedtime || !bedtime.enabled) return false;
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentTimeVal = currentHour * 60 + currentMin; // minutes since midnight
  
  const [startHour, startMin] = bedtime.start.split(":").map(Number);
  const [endHour, endMin] = bedtime.end.split(":").map(Number);
  
  const startTimeVal = startHour * 60 + startMin;
  const endTimeVal = endHour * 60 + endMin;
  
  if (startTimeVal < endTimeVal) {
    // Bedtime is within the same day (e.g. 10:00 PM to 11:59 PM)
    return currentTimeVal >= startTimeVal && currentTimeVal <= endTimeVal;
  } else {
    // Bedtime spans across midnight (e.g. 10:00 PM to 6:00 AM)
    return currentTimeVal >= startTimeVal || currentTimeVal <= endTimeVal;
  }
}

// Main function: Calculate elapsed time and save to storage
async function trackTime() {
  const today = getTodayDateString();
  
  // Date change check: reset blocking rules at midnight
  if (today !== lastCheckDate) {
    lastCheckDate = today;
    await updateBlockingRules();
  }

  if (isIdle || !activeDomain) {
    lastActiveTime = Date.now();
    return;
  }

  const now = Date.now();
  if (!lastActiveTime) {
    lastActiveTime = now;
    return;
  }

  const elapsedSeconds = Math.round((now - lastActiveTime) / 1000);
  if (elapsedSeconds <= 0) return;

  // Discard tracking updates if elapsed time exceeds 15 seconds. 
  // This indicates a service worker wake event, computer sleep/wake, 
  // or inactive tab state transition, preventing false timing spikes.
  if (elapsedSeconds > 15) {
    lastActiveTime = now;
    return;
  }

  lastActiveTime = now;

  // Retrieve stats and save
  const data = await chrome.storage.local.get("stats");
  const stats = data.stats || {};
  if (!stats[today]) {
    stats[today] = {};
  }

  stats[today][activeDomain] = (stats[today][activeDomain] || 0) + elapsedSeconds;
  await chrome.storage.local.set({ stats });

  // Check if this domain exceeded its app timer limit
  const settingsData = await chrome.storage.local.get("settings");
  const settings = settingsData.settings || getDefaultSettings();
  const limitSeconds = settings.appTimers ? settings.appTimers[activeDomain] : undefined;

  if (limitSeconds !== undefined) {
    const elapsed = stats[today][activeDomain] || 0;
    if (elapsed >= limitSeconds) {
      // Exceeded daily limit! Update rules to block this domain.
      await updateBlockingRules();
    } else {
      const remaining = limitSeconds - elapsed;
      if (remaining <= 60 && remaining > 0 && warnedDomains[activeDomain] !== today) {
        warnedDomains[activeDomain] = today;
        chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([activeTab]) => {
          if (activeTab && activeTab.id) {
            chrome.tabs.sendMessage(activeTab.id, {
              type: "SHOW_WARNING",
              message: `You have less than 60 seconds remaining on ${activeDomain} today.`
            }).catch(() => {});
          }
        });
      }
    }
  }
}

// Synchronize storage configurations with declarativeNetRequest rules
async function updateBlockingRules() {
  const settingsData = await chrome.storage.local.get("settings");
  const settings = settingsData.settings || getDefaultSettings();
  
  const statsData = await chrome.storage.local.get("stats");
  const stats = statsData.stats || {};
  
  const today = getTodayDateString();
  const todayStats = stats[today] || {};
  
  const newRules = [];
  let ruleId = 1;

  const isBedtime = checkBedtimeActive(settings.bedtimeMode);

  // 1. Bedtime Mode rules (highest priority - blocks everything)
  if (isBedtime) {
    newRules.push({
      id: ruleId++,
      priority: 3,
      action: { type: "block" },
      condition: {
        urlFilter: "|http://*",
        resourceTypes: ["main_frame", "sub_frame"]
      }
    });
    newRules.push({
      id: ruleId++,
      priority: 3,
      action: { type: "block" },
      condition: {
        urlFilter: "|https://*",
        resourceTypes: ["main_frame", "sub_frame"]
      }
    });
  }

  // 2. Focus Mode rules (block all except allowlist)
  if (settings.focusMode && !isBedtime) {
    // Block all http/https traffic at priority 1
    newRules.push({
      id: ruleId++,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: "|http://*",
        resourceTypes: ["main_frame", "sub_frame"]
      }
    });
    newRules.push({
      id: ruleId++,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: "|https://*",
        resourceTypes: ["main_frame", "sub_frame"]
      }
    });

    // Allow list at priority 2 (overriding priority 1 blocks)
    const allowlist = settings.focusAllowlist || [];
    for (const domain of allowlist) {
      const clean = domain.trim();
      if (clean) {
        newRules.push({
          id: ruleId++,
          priority: 2,
          action: { type: "allow" },
          condition: {
            urlFilter: `||${clean}`,
            resourceTypes: ["main_frame", "sub_frame"]
          }
        });
      }
    }
  }

  // 3. Parental Control Blocklist (priority 2 block)
  if (!isBedtime) {
    const blocklist = settings.blocklist || [];
    for (const domain of blocklist) {
      const clean = domain.trim();
      if (clean) {
        newRules.push({
          id: ruleId++,
          priority: 2,
          action: { type: "block" },
          condition: {
            urlFilter: `||${clean}`,
            resourceTypes: ["main_frame", "sub_frame"]
          }
        });
      }
    }
  }

  // 4. Daily App Timers Exceeded (priority 2 block)
  if (!isBedtime) {
    const appTimers = settings.appTimers || {};
    for (const [domain, limitSeconds] of Object.entries(appTimers)) {
      const elapsed = todayStats[domain] || 0;
      if (elapsed >= limitSeconds) {
        newRules.push({
          id: ruleId++,
          priority: 2,
          action: { type: "block" },
          condition: {
            urlFilter: `||${domain}`,
            resourceTypes: ["main_frame", "sub_frame"]
          }
        });
      }
    }
  }

  // Fetch current rules to remove them cleanly
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingRuleIds = existingRules.map(r => r.id);

  // Apply new rules atomically
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingRuleIds,
    addRules: newRules
  });

  // Reload tabs that are now blocked to enforce the rule instantly
  const openTabs = await chrome.tabs.query({});
  for (const tab of openTabs) {
    const tabDomain = getDomain(tab.url);
    if (!tabDomain) continue;

    let shouldBlock = false;
    if (isBedtime) {
      shouldBlock = true;
    } else if (settings.focusMode) {
      const isAllowed = (settings.focusAllowlist || []).some(allowed => 
        tabDomain === allowed || tabDomain.endsWith("." + allowed)
      );
      if (!isAllowed) shouldBlock = true;
    } else {
      const isInBlocklist = (settings.blocklist || []).some(blocked => 
        tabDomain === blocked || tabDomain.endsWith("." + blocked)
      );
      if (isInBlocklist) {
        shouldBlock = true;
      } else {
        const limitSeconds = settings.appTimers ? settings.appTimers[tabDomain] : undefined;
        if (limitSeconds !== undefined) {
          const elapsed = todayStats[tabDomain] || 0;
          if (elapsed >= limitSeconds) {
            shouldBlock = true;
          }
        }
      }
    }

    if (shouldBlock) {
      try {
        chrome.tabs.reload(tab.id);
      } catch (e) {
        // Tab may have been closed
      }
    }
  }
}

// Get the current active tab and set up tracking variables
async function handleActiveTabChange() {
  // Save current progress before switching
  await trackTime();

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab && tab.url) {
      activeDomain = getDomain(tab.url);
      lastActiveTime = Date.now();
    } else {
      activeDomain = null;
      lastActiveTime = null;
    }
  } catch (e) {
    activeDomain = null;
    lastActiveTime = null;
  }
}

// Initialise Service Worker
async function initialize() {
  const data = await chrome.storage.local.get("settings");
  if (!data.settings) {
    await chrome.storage.local.set({ settings: getDefaultSettings() });
  }

  // Set up 60 seconds threshold for Idle state
  chrome.idle.setDetectionInterval(60);

  // Set up trackers
  await handleActiveTabChange();
  await updateBlockingRules();

  // Start internal interval timer
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(trackTime, 5000); // Save increment every 5s while active
}

// Event Listeners
chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);

// Tab Activation (switch tabs)
chrome.tabs.onActivated.addListener(handleActiveTabChange);

// Tab URL Change (navigate in current tab)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (activeTab && activeTab.id === tabId) {
      await handleActiveTabChange();
    }
  }
});

// Window Focus Change (switch app or window)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus
    await trackTime();
    activeDomain = null;
    lastActiveTime = null;
  } else {
    await handleActiveTabChange();
  }
});

// Idle State Changes
chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === "idle" || state === "locked") {
    await trackTime();
    isIdle = true;
    activeDomain = null;
    lastActiveTime = null;
  } else {
    isIdle = false;
    await handleActiveTabChange();
  }
});

// Alarm Listener (backup check / wake service worker)
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("tickAlarm", { periodInMinutes: 1 });
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("tickAlarm", { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "tickAlarm") {
    await trackTime();
    // Re-check Bedtime state and timer boundaries
    await updateBlockingRules();
  }
});

// Message Listener from UI pages (Popup/Dashboard)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SETTINGS_UPDATED") {
    updateBlockingRules().then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: err.toString() });
    });
    return true; // async response
  } else if (message.type === "FORCE_SAVE_TIME") {
    trackTime().then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: err.toString() });
    });
    return true; // async response
  }
});
