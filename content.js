// Content Script for Aegis Wellbeing
// Injects beautiful non-intrusive notification toasts for screen time warnings

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SHOW_WARNING") {
    showWarningToast(message.message);
  }
});

function showWarningToast(text) {
  // Remove existing toast if present
  const existing = document.getElementById("aegis-wellbeing-toast");
  if (existing) {
    existing.remove();
  }

  // Create toast container
  const toast = document.createElement("div");
  toast.id = "aegis-wellbeing-toast";
  
  // Set inline styles to avoid site conflicts
  Object.assign(toast.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    backgroundColor: "rgba(15, 17, 26, 0.95)",
    backdropFilter: "blur(12px)",
    webkitBackdropFilter: "blur(12px)",
    border: "1.5px solid rgba(0, 229, 255, 0.45)",
    borderRadius: "14px",
    padding: "16px 20px",
    boxShadow: "0 0 20px rgba(0, 229, 255, 0.25), 0 10px 40px rgba(0, 0, 0, 0.6)",
    color: "#FFFFFF",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    fontSize: "13px",
    fontWeight: "600",
    zIndex: "2147483647", // Maximum z-index
    transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
    transform: "translateY(-30px)",
    opacity: "0",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    maxWidth: "320px",
    pointerEvents: "none"
  });

  // Icon HTML (Shield/Lock)
  const iconSvg = `
    <div style="
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: linear-gradient(135deg, #00E5FF 0%, #00B0FF 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 0 8px rgba(0, 229, 255, 0.4);
    ">
      <svg xmlns="http://www.w3.org/2000/svg" style="width: 16px; height: 16px; color: #0F111A;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    </div>
  `;

  // Text Container
  const textContainer = `
    <div style="display: flex; flex-direction: column; gap: 2px;">
      <span style="color: #00E5FF; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 800;">Aegis Wellbeing</span>
      <span style="color: #E2E8F0; line-height: 1.4; font-weight: 500;">${text}</span>
    </div>
  `;

  toast.innerHTML = iconSvg + textContainer;
  document.body.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.style.transform = "translateY(0)";
    toast.style.opacity = "1";
  }, 100);

  // Dismiss after 8 seconds
  setTimeout(() => {
    toast.style.transform = "translateY(-30px)";
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.remove();
    }, 500);
  }, 8000);
}
