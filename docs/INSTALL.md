# Installation & Local Development

Follow these steps to install the extension locally for development and preview.

1. Clone or download this repository to a local folder.
2. Open Google Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the root folder of this repository.
5. Pin the extension to the toolbar for quick access.

Notes
-----
- Some features (background timers, alarms) require the extension to be loaded as an unpacked extension to work fully.
- Open `dashboard.html` in a new tab to preview the dashboard UI; charts will render using `lib/chart.min.js`.
- To iterate on styles, edit `styles.css` or `lib/tailwind.min.css` and refresh the dashboard tab.

Development tips
----------------
- Use the Chrome Extensions panel to inspect background/service-worker logs and view errors.
- If you modify `manifest.json`, click the refresh icon for the extension in `chrome://extensions` to apply changes.
- To test content script behavior on pages, use the DevTools console on the target page to view messages from `content.js`.
